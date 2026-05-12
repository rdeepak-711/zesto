import { NextRequest, NextResponse } from 'next/server'
import { verifyOtp } from '@/lib/otp'
import { signToken, authCookieOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json()

  if (!phone || !code) {
    return NextResponse.json({ error: 'Phone and code required' }, { status: 400 })
  }

  const { valid, tenantId } = await verifyOtp(phone, code)
  if (!valid || !tenantId) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
  }

  // phone here is the ownerPhone OTP was sent to — just verify tenant is still active
  const tenant = await db.tenant.findFirst({ where: { id: tenantId, active: true } })
  if (!tenant) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
  }

  const token = signToken({ phone, tenantId, role: 'owner' })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(authCookieOptions(token))
  return res
}
