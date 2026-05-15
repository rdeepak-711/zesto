import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRazorpay } from '@/lib/razorpay'

export async function POST(req: NextRequest) {
  const { orderId } = await req.json()
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status !== 'ACCEPTED') {
    return NextResponse.json({ error: 'Order must be ACCEPTED before requesting payment' }, { status: 400 })
  }

  const amountPaise = order.totalAmount
  if (amountPaise < 100) {
    return NextResponse.json({ error: 'Amount must be at least ₹1 (100 paise)' }, { status: 400 })
  }

  const tenant = order.tenantId
    ? await db.tenant.findUnique({ where: { id: order.tenantId }, select: { razorpayKeyId: true, razorpayKeySecret: true } })
    : null

  try {
    const rzpOrder = await getRazorpay(tenant ?? {}).orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: order.id.slice(0, 40),
      notes: {
        zesto_order_id: order.id,
        customer_phone: order.customerPhone,
      },
    })

    // Store Razorpay order ID on our order
    await db.order.update({
      where: { id: orderId },
      data: { paymentLinkId: rzpOrder.id as string },
    })

    return NextResponse.json({
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('Razorpay create order error:', err)
    return NextResponse.json({ error: `Payment gateway error: ${detail}` }, { status: 500 })
  }
}
