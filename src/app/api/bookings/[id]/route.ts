import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromCookies } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/twilio'

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const booking = await db.booking.findUnique({
    where: { id },
    include: { order: true },
  })

  if (!booking || booking.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const tenant = await db.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { whatsappNumber: true },
  })

  const body = await req.json() as {
    status?: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
    confirmedDate?: string
    confirmedTime?: string
  }

  const botMessages = await db.botMessage.findMany({ where: { tenantId: auth.tenantId } })
  const messages = Object.fromEntries(botMessages.map((r) => [r.key, r.value]))

  await db.booking.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.confirmedDate ? { confirmedDate: body.confirmedDate } : {}),
      ...(body.confirmedTime ? { confirmedTime: body.confirmedTime } : {}),
    },
  })

  const from = tenant?.whatsappNumber
  const d = body.confirmedDate || booking.confirmedDate || booking.preferredDate
  const t = body.confirmedTime || booking.confirmedTime || booking.preferredTime

  if (body.status === 'CONFIRMED') {
    const msg = fill(messages['booking_confirmed'] ?? '✅ Your appointment is confirmed for *{date}* at *{time}*. See you soon! 💅', { date: d, time: t })
    await sendWhatsApp(booking.customerPhone, msg, from)
  } else if (body.status === 'CANCELLED') {
    const msg = messages['booking_cancelled'] ?? 'Your booking has been cancelled. Feel free to book again anytime 🙏'
    await sendWhatsApp(booking.customerPhone, msg, from)
  } else if (body.confirmedDate || body.confirmedTime) {
    const msg = fill(messages['booking_rescheduled'] ?? 'Your appointment has been moved to *{date}* at *{time}*. See you then!', { date: d, time: t })
    await sendWhatsApp(booking.customerPhone, msg, from)
  }

  const updated = await db.booking.findUnique({ where: { id } })
  return NextResponse.json({ booking: updated })
}
