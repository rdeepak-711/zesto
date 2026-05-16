import { NextRequest, NextResponse } from 'next/server'
import { sendOtp } from '@/lib/otp'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { phone, tenantId } = await req.json()

  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'Phone required' }, { status: 400 })
  }

  // Look up by ownerPhone first, then whatsappNumber as fallback (for test/demo numbers)
  let tenant = await db.tenant.findFirst({
    where: { ownerPhone: phone, active: true },
    select: { id: true, ownerPhone: true },
  })

  if (!tenant) {
    tenant = await db.tenant.findFirst({
      where: { whatsappNumber: phone, active: true },
      select: { id: true, ownerPhone: true },
    })
  }

  if (!tenant) return NextResponse.json({ ok: true })

  await sendOtp(tenant.ownerPhone, tenant.id)
  return NextResponse.json({ ok: true })
}
