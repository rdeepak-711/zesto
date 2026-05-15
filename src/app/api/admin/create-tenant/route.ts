import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret')
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { businessName, ownerPhone, whatsappNumber, businessType, currency } = await req.json()

  if (!businessName || !ownerPhone || !whatsappNumber) {
    return NextResponse.json({ error: 'businessName, ownerPhone, whatsappNumber required' }, { status: 400 })
  }

  const existing = await db.tenant.findUnique({ where: { whatsappNumber } })
  if (existing) {
    return NextResponse.json({ error: 'WhatsApp number already registered' }, { status: 409 })
  }

  const tenant = await db.tenant.create({
    data: {
      businessName,
      ownerPhone,
      whatsappNumber,
      businessType: businessType ?? 'other',
      currency: currency ?? 'INR',
    },
  })

  return NextResponse.json({ id: tenant.id, businessName: tenant.businessName, whatsappNumber: tenant.whatsappNumber })
}
