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

async function handleBakerReply(body: string, bakerPhone: string) {
  const upper = body.trim().toUpperCase()
  const acceptMatch = upper.match(/^ACCEPT\s+([A-Z0-9]{8})/)
  const rejectMatch = upper.match(/^REJECT\s+([A-Z0-9]{8})/)

  if (acceptMatch) {
    const shortId = acceptMatch[1].toLowerCase()
    const order = await db.order.findFirst({ where: { id: { startsWith: shortId } } })

    if (!order || order.status !== 'PENDING') {
      await sendWhatsApp(bakerPhone, `Order ${shortId.toUpperCase()} not found or already processed.`)
      return
    }

    await db.order.update({
      where: { id: order.id },
      data: { status: 'ACCEPTED', bakerNotifiedAt: new Date() },
    })

    const deliveryLine = order.deliveryNote ? `\n📅 *Delivery:* ${order.deliveryNote}` : ''
    await sendWhatsApp(
      order.customerPhone,
      `🎉 Your order *#${shortId.toUpperCase()}* has been accepted! The baker is now preparing it.${deliveryLine}\n\nWe'll notify you when it's ready. Thank you!`
    )
    await sendWhatsApp(bakerPhone, `✅ Order ${shortId.toUpperCase()} accepted. Customer notified.`)
  } else if (rejectMatch) {
    const shortId = rejectMatch[1].toLowerCase()
    const order = await db.order.findFirst({ where: { id: { startsWith: shortId } } })

    if (!order || order.status !== 'PENDING') {
      await sendWhatsApp(bakerPhone, `Order ${shortId.toUpperCase()} not found or already processed.`)
      return
    }

    await db.order.update({ where: { id: order.id }, data: { status: 'REJECTED' } })
    await sendWhatsApp(
      order.customerPhone,
      `We're sorry, your order could not be processed at this time. Please try again later or contact us directly.`
    )
    await sendWhatsApp(bakerPhone, `❌ Order ${shortId.toUpperCase()} rejected. Customer notified.`)
  } else {
    await sendWhatsApp(
      bakerPhone,
      `To accept an order: *ACCEPT ORDERID*\nTo reject: *REJECT ORDERID*`
    )
  }
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
    await handleBakerReply(body, customerPhone)
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
    if (isCustom && finalDescription) {
      order = await db.order.create({
        data: {
          customerPhone,
          customerName: prevOrder?.customerName ?? 'WhatsApp Customer',
          totalAmount: 0,
          notes: finalDescription,
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
          config.bakerPhone
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
        await notifyBaker(order.id, output.cart, totalAmount, customerPhone, config.bakerPhone)
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
