import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPaymentSignature } from '@/lib/razorpay'

export async function POST(req: NextRequest) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }

  const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  // Find our order by Razorpay order ID
  const order = await db.order.findFirst({
    where: { paymentLinkId: razorpay_order_id },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  await db.order.update({
    where: { id: order.id },
    data: {
      status: 'PAID',
      paymentLinkUrl: razorpay_payment_id,
    },
  })

  return NextResponse.json({ success: true, orderId: order.id })
}
