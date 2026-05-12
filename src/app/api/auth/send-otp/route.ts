import { NextRequest, NextResponse } from 'next/server'
import { sendOtp } from '@/lib/otp'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { phone, tenantId } = await req.json()

  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'Phone required' }, { status: 400 })
  }

  // If tenantId already chosen (second call after picker), go directly
  if (tenantId) {
    const t = await db.tenant.findFirst({ where: { id: tenantId, active: true } })
    if (!t) return NextResponse.json({ ok: true })
    await sendOtp(t.ownerPhone, t.id)
    return NextResponse.json({ ok: true, otpPhone: t.ownerPhone })
  }

  // Look up by ownerPhone first, then whatsappNumber as fallback (for test numbers)
  let tenants = await db.tenant.findMany({
    where: { ownerPhone: phone, active: true },
    select: { id: true, businessName: true, ownerPhone: true },
  })

  if (tenants.length === 0) {
    const t = await db.tenant.findFirst({
      where: { whatsappNumber: phone, active: true },
      select: { id: true, businessName: true, ownerPhone: true },
    })
    if (t) tenants = [t]
  }

  if (tenants.length === 0) {
    return NextResponse.json({ ok: true })
  }

  // Multiple tenants — return list so client can show picker
  if (tenants.length > 1) {
    return NextResponse.json({ ok: true, tenants: tenants.map(t => ({ id: t.id, businessName: t.businessName })) })
  }

  // Single tenant — send OTP to tenant's stored ownerPhone (not necessarily what was typed)
  const target = tenants[0]
  await sendOtp(target.ownerPhone, target.id)
  return NextResponse.json({ ok: true, otpPhone: target.ownerPhone })
}
