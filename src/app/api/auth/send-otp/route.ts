import { NextRequest, NextResponse } from 'next/server'
import { sendOtp } from '@/lib/otp'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()

  if (!phone || typeof phone !== 'string') {
    return NextResponse.json({ error: 'Phone required' }, { status: 400 })
  }

  const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })
  if (!config || config.bakerPhone !== phone) {
    // Return 200 to avoid enumeration — don't reveal valid phones
    return NextResponse.json({ ok: true })
  }

  try {
    await sendOtp(phone)
  } catch (err) {
    console.error('sendOtp failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
