import { NextRequest, NextResponse } from 'next/server'
import { verifyOtp } from '@/lib/otp'
import { signToken, authCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json()

  if (!phone || !code) {
    return NextResponse.json({ error: 'Phone and code required' }, { status: 400 })
  }

  const { valid } = await verifyOtp(phone, code)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
  }

  const token = signToken({ phone, role: 'baker' })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(authCookieOptions(token))
  return res
}
