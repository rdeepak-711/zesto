import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, saveSession, resetSession, isSessionStale } from '@/lib/botSession'
import { processMessage, type BotState, itemTotal } from '@/lib/bot/fsm'
import { sendWhatsApp } from '@/lib/twilio'
import { notifyBaker, type CustomBrief } from '@/lib/bakerNotify'
import { handleEnquiryState, ENQUIRY_STATES } from '@/lib/bot/enquiry'
import { parseBookingCommand } from '@/lib/bot/bookingCommands'
import { validateRequest } from 'twilio'
import type { Tenant } from '@prisma/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

function generateShortId(businessName: string, sequentialNum: number): string {
  const prefix = businessName
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)
  return `${prefix}-${String(sequentialNum).padStart(3, '0')}`
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}

function isWithinBusinessHours(tenant: { timezone: string; openDays: string; openTime: string; closeTime: string }): boolean {
  try {
    const localStr = new Date().toLocaleString('en-US', { timeZone: tenant.timezone })
    const local = new Date(localStr)
    const day = local.getDay()
    const openDays = tenant.openDays.split(',').map((d: string) => parseInt(d.trim()))
    if (!openDays.includes(day)) return false
    const cur = local.getHours() * 60 + local.getMinutes()
    const [oh, om] = tenant.openTime.split(':').map(Number)
    const [ch, cm] = tenant.closeTime.split(':').map(Number)
    return cur >= oh * 60 + om && cur < ch * 60 + cm
  } catch {
    return true // fail open so bugs don't block all messages
  }
}

function buildSocialFooter(tenant: { websiteUrl?: string | null; instagramUrl?: string | null; facebookUrl?: string | null }, socialFooterMsg: string): string {
  const lines: string[] = []
  if (tenant.websiteUrl) lines.push(`🌐 ${tenant.websiteUrl}`)
  if (tenant.instagramUrl) lines.push(`📸 ${tenant.instagramUrl}`)
  if (tenant.facebookUrl) lines.push(`👍 ${tenant.facebookUrl}`)
  if (lines.length === 0) return socialFooterMsg || ''
  return socialFooterMsg ? `${socialFooterMsg}\n\n${lines.join('\n')}` : lines.join('\n')
}

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

function orderStatusMessage(
  order: {
    id: string
    status: string
    totalAmount: number
    deliveryNote: string | null
    items: { name: string; quantity: number; fieldsJson?: string | null }[]
  },
  messages: Record<string, string>
): string {
  const shortId = order.id.slice(0, 8).toUpperCase()
  const deliveryLine = order.deliveryNote ? `\n📅 *Delivery:* ${order.deliveryNote}` : ''
  const itemLines = order.items
    .map((i) => {
      const fields: { value: string }[] = JSON.parse(i.fieldsJson ?? '[]')
      const fieldStr = fields.filter(f => f.value).map(f => f.value).join(', ')
      return `• ${i.name}${fieldStr ? ` (${fieldStr})` : ''} × ${i.quantity}`
    })
    .join('\n')

  const statusEmoji: Record<string, string> = {
    PENDING: '🕐',
    ACCEPTED: '👨‍🍳',
    PAID: '💳',
    COMPLETED: '✅',
    REJECTED: '❌',
  }

  const statusText: Record<string, string> = {
    PENDING: 'Awaiting review',
    ACCEPTED: 'Being prepared',
    PAID: 'Payment received — being prepared',
    COMPLETED: 'Ready! 🎉',
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

// ── Owner (baker) session helpers ─────────────────────────────────────────────

type OwnerState = 'BAKER_IDLE' | 'BAKER_LIST' | 'BAKER_DETAIL'

type OwnerContext = {
  page?: number
  orderIds?: string[]
  selectedOrderId?: string
}

async function getOwnerSession(ownerPhone: string, tenantId: string): Promise<{ state: OwnerState; context: OwnerContext }> {
  const row = await db.botSession.upsert({
    where: { customerPhone_tenantId: { customerPhone: ownerPhone, tenantId } },
    update: {},
    create: { customerPhone: ownerPhone, tenantId, state: 'BAKER_IDLE', contextJson: '{}', cartJson: '[]' },
  })
  return {
    state: (row.state as OwnerState) || 'BAKER_IDLE',
    context: JSON.parse(row.contextJson || '{}') as OwnerContext,
  }
}

async function saveOwnerSession(ownerPhone: string, tenantId: string, state: OwnerState, context: OwnerContext) {
  await db.botSession.update({
    where: { customerPhone_tenantId: { customerPhone: ownerPhone, tenantId } },
    data: { state, contextJson: JSON.stringify(context) },
  })
}

// ── Owner order list builder ──────────────────────────────────────────────────

const PAGE_SIZE = 5

const STATUS_EMOJI: Record<string, string> = {
  PENDING: '🕐', ACCEPTED: '👨‍🍳', PAID: '💳', COMPLETED: '✅', REJECTED: '❌',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', ACCEPTED: 'Accepted', PAID: 'Paid', COMPLETED: 'Completed', REJECTED: 'Rejected',
}

async function sendOwnerList(ownerPhone: string, tenant: Tenant, page: number) {
  const total = await db.order.count({
    where: { tenantId: tenant.id, status: { in: ['PENDING', 'ACCEPTED', 'PAID'] } },
  })

  if (total === 0) {
    await sendWhatsApp(ownerPhone, `📋 No active orders right now.\n\nType *orders* to refresh.`, tenant.whatsappNumber)
    await saveOwnerSession(ownerPhone, tenant.id, 'BAKER_IDLE', {})
    return
  }

  const orders = await db.order.findMany({
    where: { tenantId: tenant.id, status: { in: ['PENDING', 'ACCEPTED', 'PAID'] } },
    orderBy: { createdAt: 'asc' },
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { items: true },
  })

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

  await sendWhatsApp(ownerPhone, msg, tenant.whatsappNumber)
  await db.botSession.update({
    where: { customerPhone_tenantId: { customerPhone: ownerPhone, tenantId: tenant.id } },
    data: {
      state: 'BAKER_LIST',
      contextJson: JSON.stringify({ page, orderIds: orders.map(o => o.id) }),
    },
  })
}

async function sendOwnerDetail(ownerPhone: string, tenant: Tenant, orderId: string, returnPage: number) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order) {
    await sendWhatsApp(ownerPhone, `Order not found. Type *orders* to refresh.`, tenant.whatsappNumber)
    return
  }

  const shortId = order.id.slice(0, 8).toUpperCase()
  const itemLines = order.items
    .map(i => {
      const fields: { value: string }[] = JSON.parse((i as any).fieldsJson ?? '[]')
      const fieldStr = fields.filter(f => f.value).map(f => f.value).join(', ')
      return `• ${i.name}${fieldStr ? ` (${fieldStr})` : ''} × ${i.quantity}`
    })
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

  await sendWhatsApp(ownerPhone, msg, tenant.whatsappNumber)
  await db.botSession.update({
    where: { customerPhone_tenantId: { customerPhone: ownerPhone, tenantId: tenant.id } },
    data: {
      state: 'BAKER_DETAIL',
      contextJson: JSON.stringify({ selectedOrderId: orderId, page: returnPage }),
    },
  })
}

// ── Booking command handler ───────────────────────────────────────────────────

async function handleBookingCommand(cmd: string, shortId: string, extra: string, ownerPhone: string, tenant: { id: string; whatsappNumber: string }, messages: Record<string, string>) {
  try {
    const booking = await db.booking.findUnique({
      where: { shortId },
      include: { order: true },
    })

    if (!booking || booking.tenantId !== tenant.id) {
      await sendWhatsApp(ownerPhone, `Booking ${shortId} not found.`, tenant.whatsappNumber)
      return
    }

    const customerPhone = booking.customerPhone
    const [datePart, timePart] = extra ? extra.split(/\s+/, 2) : [booking.preferredDate, booking.preferredTime]

    if (cmd === 'confirm') {
      await db.booking.update({
        where: { shortId },
        data: { status: 'CONFIRMED', confirmedDate: datePart || booking.preferredDate, confirmedTime: timePart || booking.preferredTime },
      })
      const d = datePart || booking.preferredDate
      const t = timePart || booking.preferredTime
      const customerMsg = fill(messages['booking_confirmed'] ?? '✅ Your appointment is confirmed for *{date}* at *{time}*. See you soon! 💅', { date: d, time: t })
      await sendWhatsApp(customerPhone, customerMsg, tenant.whatsappNumber)
      await sendWhatsApp(ownerPhone, `✅ Booking ${shortId} confirmed — ${d} ${t}. Customer notified.`, tenant.whatsappNumber)
    } else if (cmd === 'reschedule') {
      await db.booking.update({
        where: { shortId },
        data: { status: 'CONFIRMED', confirmedDate: datePart || booking.preferredDate, confirmedTime: timePart || booking.preferredTime },
      })
      const d = datePart || booking.preferredDate
      const t = timePart || booking.preferredTime
      const customerMsg = fill(messages['booking_rescheduled'] ?? 'Your appointment has been moved to *{date}* at *{time}*. See you then!', { date: d, time: t })
      await sendWhatsApp(customerPhone, customerMsg, tenant.whatsappNumber)
      await sendWhatsApp(ownerPhone, `📅 Booking ${shortId} rescheduled to ${d} ${t}. Customer notified.`, tenant.whatsappNumber)
    } else if (cmd === 'cancel') {
      await db.booking.update({ where: { shortId }, data: { status: 'CANCELLED' } })
      const customerMsg = messages['booking_cancelled'] ?? 'Your booking has been cancelled. Feel free to book again anytime 🙏'
      await sendWhatsApp(customerPhone, customerMsg, tenant.whatsappNumber)
      await sendWhatsApp(ownerPhone, `❌ Booking ${shortId} cancelled. Customer notified.`, tenant.whatsappNumber)
    }
  } catch (err) {
    console.error('[handleBookingCommand] Failed to process booking command:', err)
    await sendWhatsApp(ownerPhone, `Failed to process booking command for ${shortId}. Please check the dashboard.`, tenant.whatsappNumber).catch(() => {})
  }
}

// ── Main owner handler ────────────────────────────────────────────────────────

async function handleOwnerReply(body: string, ownerPhone: string, tenant: Tenant) {
  const m = body.trim().toLowerCase()
  const { state, context } = await getOwnerSession(ownerPhone, tenant.id)

  // Booking commands: confirm/reschedule/cancel <shortId> [date time]
  const bookingMatch = parseBookingCommand(body)
  if (bookingMatch) {
    try {
      const botMessages = await db.botMessage.findMany({ where: { tenantId: tenant.id } })
      const msgs = Object.fromEntries(botMessages.map((r) => [r.key, r.value]))
      await handleBookingCommand(bookingMatch.cmd, bookingMatch.shortId, bookingMatch.extra, ownerPhone, tenant, msgs)
    } catch (err) {
      console.error('[handleOwnerReply] Booking command failed:', err)
    }
    return
  }

  if (m === 'orders' || m === 'list' || m === 'menu') {
    await sendOwnerList(ownerPhone, tenant, 0)
    return
  }

  if (state === 'BAKER_LIST') {
    const page = context.page ?? 0
    const orderIds = context.orderIds ?? []

    if (m === 'next') { await sendOwnerList(ownerPhone, tenant, page + 1); return }
    if (m === 'prev' && page > 0) { await sendOwnerList(ownerPhone, tenant, page - 1); return }

    const pick = parseInt(m, 10)
    if (pick >= 1 && pick <= orderIds.length) {
      await sendOwnerDetail(ownerPhone, tenant, orderIds[pick - 1], page)
      return
    }
  }

  if (state === 'BAKER_DETAIL') {
    const { selectedOrderId, page = 0 } = context

    if (m === 'back' || m === '0') {
      await sendOwnerList(ownerPhone, tenant, page)
      return
    }

    if (!selectedOrderId) {
      await sendOwnerList(ownerPhone, tenant, 0)
      return
    }

    const order = await db.order.findUnique({ where: { id: selectedOrderId } })
    if (!order) {
      await sendWhatsApp(ownerPhone, `Order not found. Type *orders* to see active orders.`, tenant.whatsappNumber)
      await saveOwnerSession(ownerPhone, tenant.id, 'BAKER_IDLE', {})
      return
    }

    const shortId = order.id.slice(0, 8).toUpperCase()
    const action = parseInt(m, 10)

    if (order.status === 'PENDING') {
      if (action === 1) {
        await db.order.update({ where: { id: order.id }, data: { status: 'ACCEPTED', bakerNotifiedAt: new Date() } })
        const deliveryLine = order.deliveryNote ? `\n📅 *Delivery:* ${order.deliveryNote}` : ''
        if (order.totalAmount > 0) {
          const payUrl = `${APP_URL}/pay/${order.id}`
          await sendWhatsApp(order.customerPhone, `🎉 Your order *#${shortId}* has been accepted!${deliveryLine}\n\n💳 Please complete your payment:\n${payUrl}\n\nWe'll start preparing once payment is received.`, tenant.whatsappNumber)
          await sendWhatsApp(ownerPhone, `✅ Order #${shortId} accepted. Payment link sent to customer.`, tenant.whatsappNumber)
        } else {
          await sendWhatsApp(order.customerPhone, `🎉 Your order *#${shortId}* has been accepted!${deliveryLine}\n\nWe'll notify you when it's ready.`, tenant.whatsappNumber)
          await sendWhatsApp(ownerPhone, `✅ Order #${shortId} accepted. Customer notified.`, tenant.whatsappNumber)
        }
        await sendOwnerList(ownerPhone, tenant, page)
        return
      }
      if (action === 2) {
        await db.order.update({ where: { id: order.id }, data: { status: 'REJECTED' } })
        await sendWhatsApp(order.customerPhone, `We're sorry, your order could not be processed. Please try again or contact us directly.`, tenant.whatsappNumber)
        await sendWhatsApp(ownerPhone, `❌ Order #${shortId} rejected. Customer notified.`, tenant.whatsappNumber)
        await sendOwnerList(ownerPhone, tenant, page)
        return
      }
    }

    if (order.status === 'ACCEPTED') {
      if (action === 1) {
        if (order.totalAmount <= 0) {
          await sendWhatsApp(ownerPhone, `Order #${shortId} has no amount set. Update it from the dashboard first.`, tenant.whatsappNumber)
          await sendOwnerDetail(ownerPhone, tenant, order.id, page)
          return
        }
        const payUrl = `${APP_URL}/pay/${order.id}`
        await sendWhatsApp(order.customerPhone, `💳 Payment request for *#${shortId}*\n\nAmount: ₹${(order.totalAmount / 100).toFixed(0)}\n\nPay here:\n${payUrl}`, tenant.whatsappNumber)
        await sendWhatsApp(ownerPhone, `💳 Payment link sent for order #${shortId}.`, tenant.whatsappNumber)
        await sendOwnerList(ownerPhone, tenant, page)
        return
      }
      if (action === 2) {
        await db.order.update({ where: { id: order.id }, data: { status: 'REJECTED' } })
        await sendWhatsApp(order.customerPhone, `We're sorry, your order could not be processed. Please try again or contact us directly.`, tenant.whatsappNumber)
        await sendWhatsApp(ownerPhone, `❌ Order #${shortId} rejected. Customer notified.`, tenant.whatsappNumber)
        await sendOwnerList(ownerPhone, tenant, page)
        return
      }
      if (action === 3) {
        await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })
        await sendWhatsApp(order.customerPhone, `🎉 Your order *#${shortId}* is ready! Thank you.\n\nHow was your experience? Reply with a rating from *1–5* ⭐`, tenant.whatsappNumber)
        await sendWhatsApp(ownerPhone, `✅ Order #${shortId} marked as completed.`, tenant.whatsappNumber)
        await sendOwnerList(ownerPhone, tenant, page)
        return
      }
    }

    if (order.status === 'PAID') {
      if (action === 1) {
        await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })
        await sendWhatsApp(order.customerPhone, `🎉 Your order *#${shortId}* is ready! Thank you.\n\nHow was your experience? Reply with a rating from *1–5* ⭐`, tenant.whatsappNumber)
        await sendWhatsApp(ownerPhone, `✅ Order #${shortId} marked as completed.`, tenant.whatsappNumber)
        await sendOwnerList(ownerPhone, tenant, page)
        return
      }
    }

    await sendOwnerDetail(ownerPhone, tenant, order.id, page)
    return
  }

  await sendWhatsApp(
    ownerPhone,
    `👋 *${tenant.businessName} — Owner Menu*\n\nType *orders* to see and manage active orders.`,
    tenant.whatsappNumber
  )
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  // Verify Twilio signature — reject spoofed requests
  const signature = req.headers.get('x-twilio-signature') ?? ''
  const webhookUrl = `${APP_URL}/api/webhook/whatsapp`
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value.toString() })
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const bypassSig = process.env.TEST_WEBHOOK_BYPASS?.trim() === 'true'
  if (!bypassSig && !validateRequest(authToken, signature, webhookUrl, params)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const body = formData.get('Body')?.toString().trim() ?? ''
  const rawFrom = formData.get('From')?.toString() ?? ''
  const rawTo = formData.get('To')?.toString() ?? ''
  const customerPhone = rawFrom.replace('whatsapp:', '')
  const toNumber = rawTo.replace('whatsapp:', '')
  const numMedia = parseInt(formData.get('NumMedia')?.toString() ?? '0', 10)
  const mediaUrl = formData.get('MediaUrl0')?.toString()

  if (!customerPhone) return new NextResponse('Bad Request', { status: 400 })

  // Route by the WA number that received the message → find the right tenant
  const tenant = await db.tenant.findUnique({
    where: { whatsappNumber: toNumber },
  })

  if (!tenant || !tenant.active) {
    return new NextResponse('', { status: 200 })
  }

  // Owner reply — route to owner handler
  if (customerPhone === tenant.ownerPhone) {
    await handleOwnerReply(body, customerPhone, tenant)
    return new NextResponse('', { status: 200 })
  }

  // ── Business hours check ──────────────────────────────────────────────────
  if (!isWithinBusinessHours(tenant)) {
    const closedMsg = await db.botMessage.findUnique({
      where: { key_tenantId: { key: 'closed_message', tenantId: tenant.id } },
    })
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const openDayLabels = tenant.openDays.split(',').map((d: string) => dayNames[parseInt(d)] ?? d).join('–')
    const reply = (closedMsg?.value ?? "😴 We're closed right now!")
      .replace('{openDays}', openDayLabels)
      .replace('{openTime}', tenant.openTime)
      .replace('{closeTime}', tenant.closeTime)
    await db.message.create({ data: { tenantId: tenant.id, customerPhone, body, direction: 'IN' } })
    await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
    await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
    return new NextResponse('', { status: 200 })
  }

  // Customer message — run bot FSM
  const [session, categories, menuItems, botMessageRows, rules, discountCodes, categoryFields] = await Promise.all([
    getSession(customerPhone, tenant.id),
    db.menuCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true, sortOrder: true, isCustom: true },
    }),
    db.menuItem.findMany({
      where: { tenantId: tenant.id, available: true },
    }),
    db.botMessage.findMany({ where: { tenantId: tenant.id } }),
    db.botRule.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { sortOrder: 'asc' } }),
    db.discountCode.findMany({ where: { tenantId: tenant.id, active: true } }),
    db.categoryField.findMany({
      where: { tenantId: tenant.id },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        itemOptions: true,
      },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const messages = Object.fromEntries(botMessageRows.map((r) => [r.key, r.value]))
  const m = body.trim().toLowerCase()

  await db.message.create({ data: { tenantId: tenant.id, customerPhone, body, direction: 'IN' } })

  // ── Enquiry mode ─────────────────────────────────────────────────────────
  // Customer leads — bot reacts to what they say, no forced welcome.
  // IDLE state is passed directly to the enquiry handler which detects intent.
  if (messages['enquiry_mode'] === 'true' && (session.state === 'IDLE' || ENQUIRY_STATES.includes(session.state))) {
    const result = await handleEnquiryState({
      tenantId: tenant.id,
      customerPhone,
      ownerPhone: tenant.ownerPhone,
      whatsappNumber: tenant.whatsappNumber,
      body,
      mediaUrl,
      numMedia,
      state: session.state,
      context: session.context as Parameters<typeof handleEnquiryState>[0]['context'],
      messages,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    })

    if (result) {
      await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: result.reply, direction: 'OUT' } })
      await sendWhatsApp(customerPhone, result.reply, tenant.whatsappNumber)
      if (result.done) {
        await resetSession(customerPhone, tenant.id)
      } else {
        await saveSession(customerPhone, result.nextState, session.cart, result.nextContext, tenant.id)
      }
      return new NextResponse('', { status: 200 })
    }
  }

  // ── Feedback collection (1-5 rating for completed order) ─────────────────
  const rating = parseInt(body.trim(), 10)
  if (rating >= 1 && rating <= 5) {
    const recentCompleted = await db.order.findFirst({
      where: { tenantId: tenant.id, customerPhone, status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      include: { feedback: true },
    })
    if (recentCompleted && !recentCompleted.feedback) {
      await db.orderFeedback.create({ data: { orderId: recentCompleted.id, rating } })
      const reply =
        rating >= 4
          ? `🌟 Thank you for the ${rating}-star rating! We're glad you loved it. See you again soon! 🎉`
          : `Thank you for your feedback (${rating}/5). We'll use this to improve. Hope to serve you better next time!`
      await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
      await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
      return new NextResponse('', { status: 200 })
    }
  }

  // ── Order selection (reply to track/cancel list) ──────────────────────────
  const selNum = parseInt(m, 10)
  if (!isNaN(selNum) && selNum >= 1 && (session.context.trackOrderIds || session.context.cancelOrderIds)) {
    if (session.context.trackOrderIds && selNum <= session.context.trackOrderIds.length) {
      const orderId = session.context.trackOrderIds[selNum - 1]
      const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } })
      const newCtx = { ...session.context, trackOrderIds: undefined }
      await saveSession(customerPhone, session.state, session.cart, newCtx, tenant.id)
      const reply = order
        ? orderStatusMessage(order, messages)
        : "Order not found. Type *track* to refresh."
      await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
      await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
      return new NextResponse('', { status: 200 })
    }

    if (session.context.cancelOrderIds && selNum <= session.context.cancelOrderIds.length) {
      const orderId = session.context.cancelOrderIds[selNum - 1]
      const order = await db.order.findUnique({ where: { id: orderId } })
      const newCtx = { ...session.context, cancelOrderIds: undefined }
      await saveSession(customerPhone, session.state, session.cart, newCtx, tenant.id)

      let reply: string
      if (!order) {
        reply = "Order not found. Type *cancel order* to try again."
      } else {
        const shortId = order.id.slice(0, 8).toUpperCase()
        if (order.status === 'PENDING') {
          await db.order.update({ where: { id: order.id }, data: { status: 'REJECTED' } })
          reply = messages['cancel_confirmed'] ?? `✅ Order #${shortId} has been cancelled. Type *hi* to start a new order.`
        } else {
          await sendWhatsApp(
            tenant.ownerPhone,
            `⚠️ *Cancellation Request*\n\nCustomer ${customerPhone} wants to cancel order *#${shortId}*.\n\nReply *2* from the order detail to reject it.`,
            tenant.whatsappNumber
          )
          reply = messages['cancel_request_sent'] ?? `Your cancellation request for order *#${shortId}* has been sent. We'll confirm shortly.`
        }
      }
      await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
      await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
      return new NextResponse('', { status: 200 })
    }
  }

  // ── Order tracking ────────────────────────────────────────────────────────
  const trackTriggers = ['track', 'status', 'order status', 'my order', 'track order', 'where is my order']
  if (trackTriggers.includes(m)) {
    const allOrders = await db.order.findMany({
      where: { tenantId: tenant.id, customerPhone },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { items: true },
    })

    let reply: string
    if (allOrders.length === 0) {
      reply = messages['track_no_order'] ?? "You don't have any orders yet. Type *hi* to place one! 🛍️"
    } else if (allOrders.length === 1) {
      reply = orderStatusMessage(allOrders[0], messages)
    } else {
      const statusEmoji: Record<string, string> = { PENDING: '🕐', ACCEPTED: '👨‍🍳', PAID: '💳', COMPLETED: '✅', REJECTED: '❌' }
      const lines = allOrders.map((o, i) => {
        const emoji = statusEmoji[o.status] ?? '📦'
        const shortId = o.id.slice(0, 8).toUpperCase()
        const date = o.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        const total = o.totalAmount > 0 ? ` — ${formatPrice(o.totalAmount)}` : ''
        return `${i + 1}. ${emoji} #${shortId}${total} (${date})`
      })
      reply = `📦 *Your Orders*\n\n${lines.join('\n')}\n\nReply with a number to see full details.`
      const newCtx = { ...session.context, trackOrderIds: allOrders.map(o => o.id) }
      await saveSession(customerPhone, session.state, session.cart, newCtx, tenant.id)
    }

    await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
    await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
    return new NextResponse('', { status: 200 })
  }

  // ── Cancel order request ──────────────────────────────────────────────────
  if (m === 'cancel order') {
    const activeOrders = await db.order.findMany({
      where: { tenantId: tenant.id, customerPhone, status: { in: ['PENDING', 'ACCEPTED', 'PAID'] } },
      orderBy: { createdAt: 'desc' },
    })

    if (activeOrders.length === 0) {
      const reply = messages['cancel_no_order'] ?? "No active order found to cancel. Type *hi* to start a new order."
      await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
      await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
      return new NextResponse('', { status: 200 })
    }

    if (activeOrders.length === 1) {
      const order = activeOrders[0]
      const shortId = order.id.slice(0, 8).toUpperCase()
      let reply: string
      if (order.status === 'PENDING') {
        await db.order.update({ where: { id: order.id }, data: { status: 'REJECTED' } })
        reply = messages['cancel_confirmed'] ?? `✅ Order #${shortId} has been cancelled. Type *hi* to start a new order.`
      } else {
        await sendWhatsApp(
          tenant.ownerPhone,
          `⚠️ *Cancellation Request*\n\nCustomer ${customerPhone} wants to cancel order *#${shortId}*.\n\nReply *2* from the order detail to reject it.`,
          tenant.whatsappNumber
        )
        reply = messages['cancel_request_sent'] ?? `Your cancellation request for order *#${shortId}* has been sent. We'll confirm shortly.`
      }
      await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
      await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
      return new NextResponse('', { status: 200 })
    }

    // Multiple active orders — let customer choose
    const lines = activeOrders.map((o, i) => {
      const shortId = o.id.slice(0, 8).toUpperCase()
      const date = o.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      const total = o.totalAmount > 0 ? ` — ${formatPrice(o.totalAmount)}` : ''
      return `${i + 1}. #${shortId}${total} (${date})`
    })
    const reply = `Which order would you like to cancel?\n\n${lines.join('\n')}\n\nReply with a number.`
    const newCtx = { ...session.context, cancelOrderIds: activeOrders.map(o => o.id) }
    await saveSession(customerPhone, session.state, session.cart, newCtx, tenant.id)
    await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
    await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
    return new NextResponse('', { status: 200 })
  }

  // ── Session staleness reset ───────────────────────────────────────────────
  if (isSessionStale(session.state, session.lastActive)) {
    await resetSession(customerPhone, tenant.id)
    const sortedCats = categories.sort((a, b) => a.sortOrder - b.sortOrder)
    const catList = sortedCats.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
    const reply = messages['welcome']
      ? messages['welcome'].replace('{businessName}', tenant.businessName).replace('{categories}', catList)
      : `Welcome back! 👋 Type *hi* to start a new order.`
    await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
    await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
    return new NextResponse('', { status: 200 })
  }

  // ── AI intent parser (natural language → fast-track to confirmation) ──────
  if (
    process.env.OPENROUTER_API_KEY &&
    (session.state === 'IDLE' || session.state === 'AWAITING_CATEGORY') &&
    body.length > 10
  ) {
    try {
      const menuSummary = menuItems
        .map(i => `${i.name} (₹${(i.price / 100).toFixed(0)})`)
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
{"items": [{"name": "exact menu item name", "quantity": 1}], "deliveryNote": "optional delivery time", "confidence": 0.0-1.0}
Rules:
- Only include items that clearly match something on the menu (fuzzy ok, but must be reasonable)
- If the message is not an order (greeting, question, gibberish), return {"items": [], "confidence": 0}
- confidence > 0.7 means you are sure about the order`,
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

          cart.push({ menuItemId: item.id, name: item.name, price: item.price, quantity: ai.quantity ?? 1, fields: [] })
        }

        if (allMatched && cart.length > 0) {
          const ctx = { ...(session.context), deliveryNote: parsed.deliveryNote ?? undefined }
          await saveSession(customerPhone, 'AWAITING_DELIVERY_DATE', cart, ctx, tenant.id)

          const cartLines = cart.map(i => `• ${i.name} × ${i.quantity} = ₹${((i.price * i.quantity) / 100).toFixed(0)}`).join('\n')
          const total = cart.reduce((s, i) => s + itemTotal(i), 0)
          const reply = parsed.deliveryNote
            ? `Got it! Here's what I have:\n\n${cartLines}\n\n*Total: ₹${(total / 100).toFixed(0)}*\n\n📅 Delivery: ${parsed.deliveryNote}\n\nWhen exactly would you like it? (or confirm the time if that's right)`
            : `Got it! Here's what I have:\n\n${cartLines}\n\n*Total: ₹${(total / 100).toFixed(0)}*\n\n📅 When would you like your order? (e.g. *Tomorrow 3pm*, *Friday evening*, *ASAP*)`

          await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: reply, direction: 'OUT' } })
          await sendWhatsApp(customerPhone, reply, tenant.whatsappNumber)
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
    minOrderAmount: tenant.minOrderAmount,
    discountCodes,
    categoryFields,
    deliveryDateEnabled: tenant.deliveryDateEnabled,
    deliveryDateLabel: tenant.deliveryDateLabel,
    businessName: tenant.businessName,
    hasBooking: tenant.hasBooking,
  })

  // ── Slot availability enrichment ─────────────────────────────────────────
  // When transitioning to AWAITING_BOOKING_TIME, enrich reply with slot counts
  let fsmReply = output.reply
  if (output.nextState === 'AWAITING_BOOKING_TIME' && output.context.bookingDate && tenant.hasBooking) {
    const confirmedBookings = await db.booking.findMany({
      where: { tenantId: tenant.id, status: 'CONFIRMED' },
      select: { confirmedDate: true, confirmedTime: true },
    })
    const dateStr = (output.context.bookingDate ?? '').toLowerCase()
    const relevant = confirmedBookings.filter((b) =>
      (b.confirmedDate ?? '').toLowerCase().includes(dateStr) ||
      dateStr.includes((b.confirmedDate ?? '').toLowerCase())
    )
    const counts = { morning: 0, afternoon: 0, evening: 0 }
    for (const b of relevant) {
      const t = (b.confirmedTime ?? '').toLowerCase()
      const isMorning = t.includes('morning') || /\b(9|10|11)\b/.test(t)
      const isAfternoon = t.includes('afternoon') || /\b(12|1pm|2pm|3pm)\b/.test(t)
      const isEvening = t.includes('evening') || /\b(4pm|5pm|6pm|7pm)\b/.test(t)
      if (isMorning) counts.morning++
      else if (isAfternoon) counts.afternoon++
      else if (isEvening) counts.evening++
    }
    const slot = (label: string, n: number) => n >= 3 ? `${label} ⚠️ Filling up` : `${label} ✅ Available`
    const base = messages['booking_ask_time'] ?? 'What time works best?'
    fsmReply =
      `${base}\n\n` +
      `1. ${slot('Morning (9am–12pm)', counts.morning)}\n` +
      `2. ${slot('Afternoon (12pm–4pm)', counts.afternoon)}\n` +
      `3. ${slot('Evening (4pm–8pm)', counts.evening)}`
  }

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
                  `You are an assistant for ${tenant.businessName}. Reformat the customer's custom order request into a clear, structured summary for the owner. Keep all details. Use bullet points. Be concise. No extra commentary.`,
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
      where: { tenantId: tenant.id, customerPhone },
      orderBy: { createdAt: 'desc' },
    })

    let order
    const paymentMethod = output.context.paymentMethod ?? 'ONLINE'

    if (isCustom && finalDescription) {
      order = await db.order.create({
        data: {
          tenantId: tenant.id,
          customerPhone,
          customerName: prevOrder?.customerName ?? 'WhatsApp Customer',
          totalAmount: 0,
          notes: finalDescription,
          paymentMethod,
          deliveryNote: output.context.deliveryNote,
          items: {
            create: [{ menuItemId: 'item-custom', name: 'Custom Order', price: 0, quantity: 1, fieldsJson: '[]' }],
          },
        },
      })
      const customBrief: CustomBrief | undefined = (output.context.customOccasion || output.context.customDate || output.context.customServings || output.context.customDietary || output.context.customBudget) ? {
        occasion: output.context.customOccasion,
        date: output.context.customDate,
        servings: output.context.customServings,
        dietary: output.context.customDietary,
        budget: output.context.customBudget,
        notes: output.context.customDescription,
      } : undefined
      await notifyBaker(
        order.id,
        [{ menuItemId: 'custom', name: `Custom Order: ${finalDescription}`, price: 0, quantity: 1, fields: [] }],
        0,
        customerPhone,
        tenant.ownerPhone,
        tenant.whatsappNumber,
        customBrief,
      )
      await saveOwnerSession(tenant.ownerPhone, tenant.id, 'BAKER_DETAIL', { selectedOrderId: order.id })
    } else if (output.cart.length > 0) {
      const cartTotal = output.cart.reduce((sum, i) => sum + itemTotal(i), 0)
      const discountAmount = output.context.appliedDiscount ?? 0
      const totalAmount = Math.max(0, cartTotal - discountAmount)

      order = await db.order.create({
        data: {
          tenantId: tenant.id,
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
              fieldsJson: JSON.stringify(item.fields ?? []),
            })),
          },
        },
      })

      if (output.context.appliedCode) {
        await db.discountCode.updateMany({
          where: { tenantId: tenant.id, code: output.context.appliedCode },
          data: { usedCount: { increment: 1 } },
        })
      }

      if (tenant.hasBooking && output.context.customerName && output.context.bookingDate) {
        try {
          const bookingCount = await db.booking.count({ where: { tenantId: tenant.id } })
          const shortId = generateShortId(tenant.businessName, bookingCount + 1)
          await db.booking.create({
            data: {
              tenantId: tenant.id,
              orderId: order.id,
              shortId,
              customerPhone,
              customerName: output.context.customerName,
              customerAge: output.context.customerAge ?? null,
              preferredDate: output.context.bookingDate,
              preferredTime: output.context.bookingTime ?? '',
            },
          })
          const serviceLines = output.cart.map((i) => `• ${i.name} — ₹${(itemTotal(i) / 100).toFixed(0)}`).join('\n')
          const ownerMsg =
            `📅 *New Booking Request* [${shortId}]\n` +
            `👤 ${output.context.customerName}, age ${output.context.customerAge ?? '?'}\n` +
            `📱 ${customerPhone}\n` +
            `📆 Preferred: ${output.context.bookingDate}, ${output.context.bookingTime ?? '?'}\n\n` +
            `Services:\n${serviceLines}\n` +
            `Total: ₹${(totalAmount / 100).toFixed(0)}\n\n` +
            `Reply:\n` +
            `*confirm ${shortId}*\n` +
            `*confirm ${shortId} 22may 2pm*\n` +
            `*reschedule ${shortId} 23may morning*\n` +
            `*cancel ${shortId}*`
          try { await sendWhatsApp(tenant.ownerPhone, ownerMsg, tenant.whatsappNumber) } catch { /* owner WA unavailable */ }
        } catch (bookingErr) {
          console.error('[booking] Failed to create booking:', bookingErr)
          try {
            await notifyBaker(order.id, output.cart, totalAmount, customerPhone, tenant.ownerPhone, tenant.whatsappNumber)
            await saveOwnerSession(tenant.ownerPhone, tenant.id, 'BAKER_DETAIL', { selectedOrderId: order.id })
          } catch { /* owner notification failed */ }
        }
      } else {
        try {
          await notifyBaker(order.id, output.cart, totalAmount, customerPhone, tenant.ownerPhone, tenant.whatsappNumber)
          await saveOwnerSession(tenant.ownerPhone, tenant.id, 'BAKER_DETAIL', { selectedOrderId: order.id })
        } catch { /* owner notification failed */ }
      }
    }

    await resetSession(customerPhone, tenant.id)
  } else {
    await saveSession(customerPhone, output.nextState, output.cart, output.context, tenant.id)
  }

  let finalReply = fsmReply
  if (output.placeOrder) {
    const footer = buildSocialFooter(tenant, messages['social_footer'] ?? '')
    if (footer) finalReply = `${output.reply}\n\n${footer}`
  }
  await db.message.create({ data: { tenantId: tenant.id, customerPhone, body: finalReply, direction: 'OUT' } })
  try { await sendWhatsApp(customerPhone, finalReply, tenant.whatsappNumber) } catch { /* WA delivery failed */ }

  return new NextResponse('', { status: 200 })
}
