import { NextRequest, NextResponse } from 'next/server'
import { sendOtp } from '@/lib/otp'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()

  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'Phone required' }, { status: 400 })
  }

  const tenant = await db.tenant.findFirst({ where: { ownerPhone: phone, active: true } })
  if (!tenant) {
    // Return 200 to avoid enumeration — don't reveal valid phones
    return NextResponse.json({ ok: true })
  }

  await sendOtp(phone, tenant.id)
  return NextResponse.json({ ok: true })
}
