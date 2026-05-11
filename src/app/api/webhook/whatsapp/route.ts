import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, saveSession, resetSession } from '@/lib/botSession'
import { processMessage, type BotState } from '@/lib/bot/fsm'
import { sendWhatsApp } from '@/lib/twilio'
import { notifyBaker } from '@/lib/bakerNotify'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

function orderStatusMessage(
  order: {
    id: string
    status: string
    totalAmount: number
    deliveryNote: string | null
    items: { name: string; quantity: number; variantName?: string | null }[]
  },
  messages: Record<string, string>
): string {
  const shortId = order.id.slice(0, 8).toUpperCase()
  const deliveryLine = order.deliveryNote ? `\n📅 *Delivery:* ${order.deliveryNote}` : ''
  const itemLines = order.items
    .map((i) => `• ${i.name}${i.variantName ? ` (${i.variantName})` : ''} × ${i.quantity}`)
    .join('\n')

  const statusEmoji: Record<string, string> = {
    PENDING: '🕐',
    ACCEPTED: '👨‍🍳',
    PAID: '💳',
    COMPLETED: '✅',
    REJECTED: '❌',
  }

  const statusText: Record<string, string> = {
    PENDING: 'Awaiting baker review',
    ACCEPTED: 'Baker is preparing your order',
    PAID: 'Payment received — being prepared',
    COMPLETED: 'Ready! 🎂',
    REJECTED: 'Order was declined',
  }

  const emoji = statusEmoji[order.status] ?? '📦'
  const text = statusText[order.status] ?? order.status

  let msg = `${emoji} *Order #${shortId}*\n\nStatus: ${text}${deliveryLine}`
  if (order.totalAmount > 0) msg += `\nAmount: ${formatPrice(order.totalAmount)}`
  msg += `\n\n${itemLines}`

  if (order.status === 'ACCEPTED' || order.status === 'PAID') {
    msg += `\n\n_Type *cancel order* to request cancellation_`
  }
  if (order.status === 'ACCEPTED' && order.totalAmount > 0 && !['PAID', 'COMPLETED'].includes(order.status)) {
    const payUrl = `${APP_URL}/pay/${order.id}`
    msg += `\n\nPay here: ${payUrl}`
  }

  return msg
}

// ── Baker session helpers ─────────────────────────────────────────────────────

type BakerState = 'BAKER_IDLE' | 'BAKER_LIST' | 'BAKER_DETAIL'

type BakerContext = {
  page?: number
  selectedOrderId?: string
}

async function getBakerSession(bakerPhone: string): Promise<{ state: BakerState; context: BakerContext }> {
  const row = await db.botSession.upsert({
    where: { customerPhone: bakerPhone },
    update: {},
    create: { customerPhone: bakerPhone, state: 'BAKER_IDLE' },
  })
  return {
    state: (row.state as BakerState) || 'BAKER_IDLE',
    context: JSON.parse(row.contextJson || '{}') as BakerContext,
  }
}

async function saveBakerSession(bakerPhone: string, state: BakerState, context: BakerContext) {
  await db.botSession.update({
    where: { customerPhone: bakerPhone },
    data: { state, contextJson: JSON.stringify(context) },
  })
}

// ── Baker list builder ────────────────────────────────────────────────────────

const PAGE_SIZE = 5

const STATUS_EMOJI: Record<string, string> = {
  PENDING: '🕐', ACCEPTED: '👨‍🍳', PAID: '💳', COMPLETED: '✅', REJECTED: '❌',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', ACCEPTED: 'Accepted', PAID: 'Paid', COMPLETED: 'Completed', REJECTED: 'Rejected',
}

async function sendBakerList(bakerPhone: string, page: number) {
  const total = await db.order.count({ where: { status: { in: ['PENDING', 'ACCEPTED', 'PAID'] } } })

  if (total === 0) {
    await sendWhatsApp(bakerPhone, `📋 No active orders right now.\n\nType *orders* to refresh.`)
    await saveBakerSession(bakerPhone, 'BAKER_IDLE', {})
    return
  }

  const orders = await db.order.findMany({
    where: { status: { in: ['PENDING', 'ACCEPTED', 'PAID'] } },
    orderBy: [
      { status: 'asc' }, // ACCEPTED < PAID < PENDING alphabetically — we'll handle priority below
      { createdAt: 'asc' },
    ],
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { items: true },
  })

  // Sort: PENDING first, then ACCEPTED, then PAID
  const priority: Record<string, number> = { PENDING: 0, ACCEPTED: 1, PAID: 2 }
  orders.sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9))

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const start = page * PAGE_SIZE + 1
  const end = Math.min(start + orders.length - 1, total)

  const lines = orders.map((o, i) => {
    const itemCount = o.items.reduce((s, it) => s + it.quantity, 0)
    const phone = o.customerPhone.replace('+91', '')
    const amount = o.totalAmount > 0 ? ` · ₹${(o.totalAmount / 100).toFixed(0)}` : ''
    return `${i + 1}. ${STATUS_EMOJI[o.status]} ${phone} · ${itemCount} item${itemCount !== 1 ? 's' : ''}${amount} · ${STATUS_LABEL[o.status]}`
  })

  let msg = `📋 *Orders* (${start}–${end} of ${total})\n\n${lines.join('\n')}\n\nReply with a number to manage`
  if (page > 0) msg += ` · *prev* for earlier`
  if (end < total) msg += ` · *next* for more`

  await sendWhatsApp(bakerPhone, msg)
  await saveBakerSession(bakerPhone, 'BAKER_LIST', {
    page,
    // store order IDs in context so selection is stable even if new orders arrive
    selectedOrderId: orders.map(o => o.id).join(',') as unknown as string,
  })

  // Overwrite with proper structure
  await db.botSession.update({
    where: { customerPhone: bakerPhone },
    data: {
      state: 'BAKER_LIST',
      contextJson: JSON.stringify({ page, orderIds: orders.map(o => o.id) }),
    },
  })
}

async function sendBakerDetail(bakerPhone: string, orderId: string, returnPage: number) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order) {
    await sendWhatsApp(bakerPhone, `Order not found. Type *orders* to refresh.`)
    return
  }

  const shortId = order.id.slice(0, 8).toUpperCase()
  const itemLines = order.items
    .map(i => `• ${i.name}${i.variantName ? ` (${i.variantName})` : ''} × ${i.quantity}`)
    .join('\n')
  const deliveryLine = order.deliveryNote ? `\n📅 ${order.deliveryNote}` : ''
  const amountLine = order.totalAmount > 0 ? `\n💰 ₹${(order.totalAmount / 100).toFixed(0)}` : ''

  const actions: string[] = []
  if (order.status === 'PENDING') {
    actions.push('1️⃣ Accept')
    actions.push('2️⃣ Reject')
  } else if (order.status === 'ACCEPTED') {
    actions.push('1️⃣ Request Payment')
    actions.push('2️⃣ Reject')
    actions.push('3️⃣ Mark Completed')
  } else if (order.status === 'PAID') {
    actions.push('1️⃣ Mark Completed')
  }

  const actionsText = actions.length > 0
    ? `\n\n*Actions:*\n${actions.join('\n')}\n\nReply with action number · *back* to list`
    : `\n\nNo actions available. *back* to return.`

  const msg =
    `📦 *Order #${shortId}*\n` +
    `📱 ${order.customerPhone}${deliveryLine}${amountLine}\n` +
    `Status: ${STATUS_EMOJI[order.status]} ${STATUS_LABEL[order.status]}\n\n` +
    itemLines +
    actionsText

  await sendWhatsApp(bakerPhone, msg)
  await db.botSession.update({
    where: { customerPhone: bakerPhone },
    data: {
      state: 'BAKER_DETAIL',
      contextJson: JSON.stringify({ selectedOrderId: orderId, page: returnPage }),
    },
  })
}

// ── Main baker handler ────────────────────────────────────────────────────────

async function handleBakerReply(body: string, bakerPhone: string, _config: unknown) {
  const m = body.trim().toLowerCase()

  const { state, context } = await getBakerSession(bakerPhone)

  // Global triggers — always available
  if (m === 'orders' || m === 'list' || m === 'menu') {
    await sendBakerList(bakerPhone, 0)
    return
  }

  // ── BAKER_LIST state ───────────────────────────────────────────────────────
  if (state === 'BAKER_LIST') {
    const page: number = (context as { page?: number; orderIds?: string[] }).page ?? 0
    const orderIds: string[] = (context as { page?: number; orderIds?: string[] }).orderIds ?? []

    if (m === 'next') { await sendBakerList(bakerPhone, page + 1); return }
    if (m === 'prev' && page > 0) { await sendBakerList(bakerPhone, page - 1); return }

    const pick = parseInt(m, 10)
    if (pick >= 1 && pick <= orderIds.length) {
      await sendBakerDetail(bakerPhone, orderIds[pick - 1], page)
      return
    }
  }

  // ── BAKER_DETAIL state ─────────────────────────────────────────────────────
  if (state === 'BAKER_DETAIL') {
    const { selectedOrderId, page = 0 } = context as { selectedOrderId?: string; page?: number }

    if (m === 'back' || m === '0') {
      await sendBakerList(bakerPhone, page)
      return
    }

    if (!selectedOrderId) {
      await sendBakerList(bakerPhone, 0)
      return
    }

    const order = await db.order.findUnique({ where: { id: selectedOrderId } })
    if (!order) {
      await sendWhatsApp(bakerPhone, `Order not found. Type *orders* to see active orders.`)
      await saveBakerSession(bakerPhone, 'BAKER_IDLE', {})
      return
    }

    const shortId = order.id.slice(0, 8).toUpperCase()
    const action = parseInt(m, 10)

    if (order.status === 'PENDING') {
      if (action === 1) {
        await db.order.update({ where: { id: order.id }, data: { status: 'ACCEPTED', bakerNotifiedAt: new Date() } })
        const deliveryLine = order.deliveryNote ? `\n📅 *Delivery:* ${order.deliveryNote}` : ''
        await sendWhatsApp(order.customerPhone, `🎉 Your order *#${shortId}* has been accepted! The baker is preparing it.${deliveryLine}\n\nWe'll notify you when it's ready.`)
        await sendWhatsApp(bakerPhone, `✅ Order #${shortId} accepted. Customer notified.`)
        await sendBakerList(bakerPhone, page)
        return
      }
      if (action === 2) {
        await db.order.update({ where: { id: order.id }, data: { status: 'REJECTED' } })
        await sendWhatsApp(order.customerPhone, `We're sorry, your order could not be processed. Please try again or contact us directly.`)
        await sendWhatsApp(bakerPhone, `❌ Order #${shortId} rejected. Customer notified.`)
        await sendBakerList(bakerPhone, page)
        return
      }
    }

    if (order.status === 'ACCEPTED') {
      if (action === 1) {
        if (order.totalAmount <= 0) {
          await sendWhatsApp(bakerPhone, `Order #${shortId} has no amount set. Update it from the dashboard first, then try again.`)
          await sendBakerDetail(bakerPhone, order.id, page)
          return
        }
        const payUrl = `${APP_URL}/pay/${order.id}`
        await sendWhatsApp(order.customerPhone, `💳 Payment request for *#${shortId}*\n\nAmount: ₹${(order.totalAmount / 100).toFixed(0)}\n\nPay here:\n${payUrl}`)
        await sendWhatsApp(bakerPhone, `💳 Payment link sent for order #${shortId}.`)
        await sendBakerList(bakerPhone, page)
        return
      }
      if (action === 2) {
        await db.order.update({ where: { id: order.id }, data: { status: 'REJECTED' } })
        await sendWhatsApp(order.customerPhone, `We're sorry, your order could not be processed. Please try again or contact us directly.`)
        await sendWhatsApp(bakerPhone, `❌ Order #${shortId} rejected. Customer notified.`)
        await sendBakerList(bakerPhone, page)
        return
      }
      if (action === 3) {
        await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })
        await sendWhatsApp(order.customerPhone, `🎉 Your order *#${shortId}* is ready! Thank you for ordering with us.\n\nHow was your experience? Reply with a rating from *1–5* ⭐`)
        await sendWhatsApp(bakerPhone, `✅ Order #${shortId} marked as completed.`)
        await sendBakerList(bakerPhone, page)
        return
      }
    }

    if (order.status === 'PAID') {
      if (action === 1) {
        await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })
        await sendWhatsApp(order.customerPhone, `🎉 Your order *#${shortId}* is ready! Thank you for ordering with us.\n\nHow was your experience? Reply with a rating from *1–5* ⭐`)
        await sendWhatsApp(bakerPhone, `✅ Order #${shortId} marked as completed.`)
        await sendBakerList(bakerPhone, page)
        return
      }
    }

    // Unknown action — re-show detail
    await sendBakerDetail(bakerPhone, order.id, page)
    return
  }

  // ── Fallback / BAKER_IDLE ──────────────────────────────────────────────────
  await sendWhatsApp(
    bakerPhone,
    `👋 *Baker Menu*\n\nType *orders* to see and manage active orders.`
  )
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const body = formData.get('Body')?.toString().trim() ?? ''
  const rawFrom = formData.get('From')?.toString() ?? ''
  const customerPhone = rawFrom.replace('whatsapp:', '')

  if (!customerPhone) return new NextResponse('Bad Request', { status: 400 })

  const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })

  // Baker reply — route to accept/reject handler
  if (config && customerPhone === config.bakerPhone) {
    await handleBakerReply(body, customerPhone, config)
    return new NextResponse('', { status: 200 })
  }

  // Customer message — run bot FSM
  const [session, categories, menuItems, botMessageRows, rules, discountCodes] = await Promise.all([
    getSession(customerPhone),
    db.menuCategory.findMany({
      where: { active: true },
      select: { id: true, name: true, sortOrder: true, isCustom: true },
    }),
    db.menuItem.findMany({
      where: { available: true },
      include: { variants: { orderBy: { sortOrder: 'asc' } } },
    }),
    db.botMessage.findMany(),
    db.botRule.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    db.discountCode.findMany({ where: { active: true } }),
  ])

  const messages = Object.fromEntries(botMessageRows.map((r) => [r.key, r.value]))
  const m = body.trim().toLowerCase()

  await db.message.create({ data: { customerPhone, body, direction: 'IN' } })

  // ── Feedback collection (1-5 rating for completed order) ─────────────────
  const rating = parseInt(body.trim(), 10)
  if (rating >= 1 && rating <= 5) {
    const recentCompleted = await db.order.findFirst({
      where: { customerPhone, status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      include: { feedback: true },
    })
    if (recentCompleted && !recentCompleted.feedback) {
      await db.orderFeedback.create({ data: { orderId: recentCompleted.id, rating } })
      const reply =
        rating >= 4
          ? `🌟 Thank you for the ${rating}-star rating! We're glad you loved it. See you again soon! 🎂`
          : `Thank you for your feedback (${rating}/5). We'll use this to improve. Hope to serve you better next time!`
      await db.message.create({ data: { customerPhone, body: reply, direction: 'OUT' } })
      await sendWhatsApp(customerPhone, reply)
      return new NextResponse('', { status: 200 })
    }
  }

  // ── Order tracking ────────────────────────────────────────────────────────
  const trackTriggers = ['track', 'status', 'order status', 'my order', 'track order', 'where is my order']
  if (trackTriggers.includes(m)) {
    const activeOrder = await db.order.findFirst({
      where: {
        customerPhone,
        status: { in: ['PENDING', 'ACCEPTED', 'PAID'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })

    let reply: string
    if (!activeOrder) {
      const lastOrder = await db.order.findFirst({
        where: { customerPhone },
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      })
      if (lastOrder) {
        reply = orderStatusMessage(lastOrder, messages)
      } else {
        reply = messages['track_no_order'] ?? "You don't have any active orders. Type *hi* to start a new order! 🛍️"
      }
    } else {
      reply = orderStatusMessage(activeOrder, messages)
    }

    await db.message.create({ data: { customerPhone, body: reply, direction: 'OUT' } })
    await sendWhatsApp(customerPhone, reply)
    return new NextResponse('', { status: 200 })
  }

  // ── Cancel order request ──────────────────────────────────────────────────
  if (m === 'cancel order') {
    const activeOrder = await db.order.findFirst({
      where: {
        customerPhone,
        status: { in: ['PENDING', 'ACCEPTED', 'PAID'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!activeOrder) {
      const reply = messages['cancel_no_order'] ?? "No active order found to cancel. Type *hi* to start a new order."
      await db.message.create({ data: { customerPhone, body: reply, direction: 'OUT' } })
      await sendWhatsApp(customerPhone, reply)
      return new NextResponse('', { status: 200 })
    }

    const shortId = activeOrder.id.slice(0, 8).toUpperCase()
    let reply: string

    if (activeOrder.status === 'PENDING') {
      // Cancel immediately
      await db.order.update({ where: { id: activeOrder.id }, data: { status: 'REJECTED' } })
      reply = messages['cancel_confirmed'] ?? `✅ Order #${shortId} has been cancelled. Type *hi* to start a new order.`
    } else {
      // ACCEPTED or PAID — notify baker, can't auto-cancel
      if (config) {
        await sendWhatsApp(
          config.bakerPhone,
          `⚠️ *Cancellation Request*\n\nCustomer ${customerPhone} wants to cancel order *#${shortId}*.\n\nReply REJECT ${shortId} if you accept the cancellation.`
        )
      }
      reply = messages['cancel_request_sent'] ?? `Your cancellation request for order *#${shortId}* has been sent to the baker. We'll confirm shortly.`
    }

    await db.message.create({ data: { customerPhone, body: reply, direction: 'OUT' } })
    await sendWhatsApp(customerPhone, reply)
    return new NextResponse('', { status: 200 })
  }

  // ── AI intent parser (natural language → fast-track to confirmation) ────────
  // Only runs when customer is idle/starting fresh and OpenRouter is configured
  if (
    process.env.OPENROUTER_API_KEY &&
    (session.state === 'IDLE' || session.state === 'AWAITING_CATEGORY') &&
    body.length > 10
  ) {
    try {
      const menuSummary = menuItems
        .map(i => `${i.name} (₹${(i.price / 100).toFixed(0)})${i.variants?.length ? ` [variants: ${i.variants.map(v => v.name).join(', ')}]` : ''}`)
        .join('\n')

      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite',
          messages: [
            {
              role: 'system',
              content: `You are an order parser for a food business. Given a customer message and menu, extract order details as JSON.
Return ONLY valid JSON in this exact shape:
{"items": [{"name": "exact menu item name", "quantity": 1, "variantHint": "optional size hint"}], "deliveryNote": "optional delivery time", "confidence": 0.0-1.0}
Rules:
- Only include items that clearly match something on the menu (fuzzy ok, but must be reasonable)
- If the message is not an order (greeting, question, gibberish), return {"items": [], "confidence": 0}
- confidence > 0.7 means you are sure about the order
- variantHint is optional, only set if customer mentioned a size/variant`,
            },
            { role: 'user', content: `Menu:\n${menuSummary}\n\nCustomer message: "${body}"` },
          ],
          max_tokens: 200,
        }),
      })

      const aiJson = await aiRes.json()
      const raw = aiJson.choices?.[0]?.message?.content ?? ''
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

      if (parsed.confidence >= 0.75 && parsed.items?.length > 0) {
        const cart: typeof session.cart = []
        let allMatched = true

        for (const ai of parsed.items) {
          const item = menuItems.find(i =>
            i.name.toLowerCase().includes(ai.name.toLowerCase()) ||
            ai.name.toLowerCase().includes(i.name.toLowerCase())
          )
          if (!item) { allMatched = false; break }

          let price = item.price
          let variantName: string | undefined

          if (item.variants?.length && ai.variantHint) {
            const v = item.variants.find(v => v.name.toLowerCase().includes(ai.variantHint.toLowerCase()))
            if (v) { price += v.priceDelta; variantName = v.name }
          }

          cart.push({ menuItemId: item.id, name: item.name, price, quantity: ai.quantity ?? 1, variantName })
        }

        if (allMatched && cart.length > 0) {
          const context = { ...(session.context), deliveryNote: parsed.deliveryNote ?? undefined }
          await saveSession(customerPhone, 'AWAITING_DELIVERY_DATE', cart, context)

          const cartLines = cart.map(i => `• ${i.name}${i.variantName ? ` (${i.variantName})` : ''} × ${i.quantity} = ₹${((i.price * i.quantity) / 100).toFixed(0)}`).join('\n')
          const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)
          const reply = parsed.deliveryNote
            ? `Got it! Here's what I have:\n\n${cartLines}\n\n*Total: ₹${(total / 100).toFixed(0)}*\n\n📅 Delivery: ${parsed.deliveryNote}\n\nWhen exactly would you like it? (or confirm the time if that's right)`
            : `Got it! Here's what I have:\n\n${cartLines}\n\n*Total: ₹${(total / 100).toFixed(0)}*\n\n📅 When would you like your order? (e.g. *Tomorrow 3pm*, *Friday evening*, *ASAP*)`

          await db.message.create({ data: { customerPhone, body: reply, direction: 'OUT' } })
          await sendWhatsApp(customerPhone, reply)
          return new NextResponse('', { status: 200 })
        }
      }
    } catch {
      // AI failed or low confidence — fall through to FSM
    }
  }

  // ── FSM ───────────────────────────────────────────────────────────────────
  const output = processMessage({
    message: body,
    state: session.state as BotState,
    cart: session.cart,
    context: session.context,
    categories,
    menuItems,
    messages,
    rules,
    minOrderAmount: config?.minOrderAmount ?? 0,
    discountCodes,
  })

  if (output.placeOrder) {
    const isCustom = !!output.context.customDescription
    const customDescription = output.context.customDescription

    let finalDescription = customDescription
    if (isCustom && process.env.OPENROUTER_API_KEY && customDescription) {
      try {
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-lite',
            messages: [
              {
                role: 'system',
                content:
                  "You are an assistant for a bakery. Reformat the customer's custom order request into a clear, structured summary for the baker. Keep all details. Use bullet points. Be concise. No extra commentary.",
              },
              { role: 'user', content: customDescription },
            ],
            max_tokens: 300,
          }),
        })
        const aiJson = await aiRes.json()
        finalDescription = aiJson.choices?.[0]?.message?.content ?? customDescription
      } catch {
        // AI failed — use raw description
      }
    }

    const prevOrder = await db.order.findFirst({
      where: { customerPhone },
      orderBy: { createdAt: 'desc' },
    })

    let order
    const paymentMethod = output.context.paymentMethod ?? 'ONLINE'

    if (isCustom && finalDescription) {
      order = await db.order.create({
        data: {
          customerPhone,
          customerName: prevOrder?.customerName ?? 'WhatsApp Customer',
          totalAmount: 0,
          notes: finalDescription,
          paymentMethod,
          deliveryNote: output.context.deliveryNote,
          items: {
            create: [{ menuItemId: 'item-custom', name: 'Custom Order', price: 0, quantity: 1 }],
          },
        },
      })
      if (config) {
        await notifyBaker(
          order.id,
          [{ menuItemId: 'custom', name: `Custom Order: ${finalDescription}`, price: 0, quantity: 1 }],
          0,
          customerPhone,
          config.bakerPhone,
          paymentMethod
        )
      }
    } else if (output.cart.length > 0) {
      const cartTotal = output.cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
      const discountAmount = output.context.appliedDiscount ?? 0
      const totalAmount = Math.max(0, cartTotal - discountAmount)

      order = await db.order.create({
        data: {
          customerPhone,
          customerName: prevOrder?.customerName ?? 'WhatsApp Customer',
          totalAmount,
          discountCode: output.context.appliedCode,
          discountAmount,
          paymentMethod,
          deliveryNote: output.context.deliveryNote,
          items: {
            create: output.cart.map((item) => ({
              menuItemId: item.menuItemId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              variantName: item.variantName,
            })),
          },
        },
      })

      if (output.context.appliedCode) {
        await db.discountCode.updateMany({
          where: { code: output.context.appliedCode },
          data: { usedCount: { increment: 1 } },
        })
      }

      if (config) {
        await notifyBaker(order.id, output.cart, totalAmount, customerPhone, config.bakerPhone, paymentMethod)
      }
    }

    await resetSession(customerPhone)
  } else {
    await saveSession(customerPhone, output.nextState, output.cart, output.context)
  }

  await db.message.create({ data: { customerPhone, body: output.reply, direction: 'OUT' } })
  await sendWhatsApp(customerPhone, output.reply)

  return new NextResponse('', { status: 200 })
}
