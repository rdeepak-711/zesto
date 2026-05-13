import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, authCookieOptions } from '@/lib/auth'

// Dev-only: set auth cookie by whatsapp number without OTP.
// Blocked in production.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const tenant = await db.tenant.findFirst({
    where: { whatsappNumber: phone, active: true },
    select: { id: true, ownerPhone: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const token = signToken({ phone: tenant.ownerPhone, tenantId: tenant.id, role: 'owner' })
  const res = NextResponse.redirect(new URL('/dashboard', req.url))
  res.cookies.set(authCookieOptions(token))
  return res
}
