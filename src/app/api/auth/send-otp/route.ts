import { NextRequest, NextResponse } from 'next/server'
import { sendOtp } from '@/lib/otp'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { phone, tenantId } = await req.json()

  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'Phone required' }, { status: 400 })
  }

  const tenants = await db.tenant.findMany({
    where: { ownerPhone: phone, active: true },
    select: { id: true, businessName: true },
  })

  if (tenants.length === 0) {
    return NextResponse.json({ ok: true })
  }

  // Multiple tenants on same phone — return list so client can show picker
  if (tenants.length > 1 && !tenantId) {
    return NextResponse.json({ ok: true, tenants })
  }

  const target = tenantId ? tenants.find(t => t.id === tenantId) : tenants[0]
  if (!target) return NextResponse.json({ ok: true })

  await sendOtp(phone, target.id)
  return NextResponse.json({ ok: true })
}
