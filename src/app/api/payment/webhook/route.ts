import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/twilio'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }

  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body) as {
    event: string
    payload: { payment: { entity: { id: string; order_id: string } } }
  }

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity
    const razorpayOrderId = payment.order_id

    const order = await db.order.findFirst({
      where: { paymentLinkId: razorpayOrderId },
    })

    if (order && order.status !== 'PAID' && order.status !== 'COMPLETED') {
      // Check if this is a 50% advance payment before marking as PAID
      const isAdvance = (order as any).advanceAmount > 0 && !(order as any).advancePaid

      if (isAdvance) {
        await db.order.update({
          where: { id: order.id },
          data: { advancePaid: true, status: 'ACCEPTED', paymentLinkUrl: payment.id },
        })
      } else {
        await db.order.update({
          where: { id: order.id },
          data: { status: 'PAID', paymentLinkUrl: payment.id },
        })
      }

      const shortId = order.id.slice(0, 8).toUpperCase()
      const tenant = order.tenantId
        ? await db.tenant.findUnique({ where: { id: order.tenantId } })
        : null

      if (isAdvance) {
        const advanceAmt = (order as any).advanceAmount as number
        await sendWhatsApp(
          order.customerPhone,
          `💳 50% advance received for order *#${shortId}*! Your order is confirmed. Remaining ₹${(advanceAmt / 100).toFixed(0)} due at delivery. Thank you! 🎂`,
          tenant?.whatsappNumber ?? undefined
        )
        if (tenant) {
          await sendWhatsApp(
            tenant.ownerPhone,
            `💰 50% advance received for order #${shortId}. Amount: ₹${(advanceAmt / 100).toFixed(0)}. Balance due at delivery.`,
            tenant.whatsappNumber
          )
        }
      } else {
        await sendWhatsApp(
          order.customerPhone,
          `💳 Payment received for order *#${shortId}*! We're now preparing your order. Thank you! 🎂`,
          tenant?.whatsappNumber ?? undefined
        )
        if (tenant) {
          await sendWhatsApp(
            tenant.ownerPhone,
            `💰 Payment received for order #${shortId}. Amount: ₹${(order.totalAmount / 100).toFixed(0)}`,
            tenant.whatsappNumber
          )
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
