import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPaymentSignature } from '@/lib/razorpay'

export async function POST(req: NextRequest) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }

  // Find our order by Razorpay order ID
  const order = await db.order.findFirst({
    where: { paymentLinkId: razorpay_order_id },
  })

  const tenant = order?.tenantId
    ? await db.tenant.findUnique({ where: { id: order.tenantId }, select: { razorpayKeyId: true, razorpayKeySecret: true } })
    : null

  const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, tenant ?? undefined)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Guard against replay and race: only transition from ACCEPTED state
  const { count } = await db.order.updateMany({
    where: { id: order.id, status: 'ACCEPTED' },
    data: { status: 'PAID', paymentLinkUrl: razorpay_payment_id },
  })

  if (count === 0) {
    // Already paid, completed, or rejected — treat as success so client doesn't retry
    return NextResponse.json({ success: true, orderId: order.id })
  }

  return NextResponse.json({ success: true, orderId: order.id })
}
