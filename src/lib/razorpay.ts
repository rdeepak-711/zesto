import Razorpay from 'razorpay'
import crypto from 'crypto'

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

type TenantCreds = { razorpayKeyId?: string | null; razorpayKeySecret?: string | null }

export function getRazorpay(tenant: TenantCreds) {
  return new Razorpay({
    key_id: tenant.razorpayKeyId ?? process.env.RAZORPAY_KEY_ID!,
    key_secret: tenant.razorpayKeySecret ?? process.env.RAZORPAY_KEY_SECRET!,
  })
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  tenant?: TenantCreds
): boolean {
  const secret = tenant?.razorpayKeySecret ?? process.env.RAZORPAY_KEY_SECRET!
  const body = `${orderId}|${paymentId}`
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return expected === signature
}
