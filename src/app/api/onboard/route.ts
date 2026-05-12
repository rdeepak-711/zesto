import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { bootstrapTenant } from '../../../../prisma/bootstrapTenant'

export async function POST(req: NextRequest) {
  const { businessName, businessType, ownerPhone, whatsappNumber, currency } = await req.json()

  if (!businessName?.trim() || !ownerPhone?.trim() || !whatsappNumber?.trim()) {
    return NextResponse.json({ error: 'businessName, ownerPhone, and whatsappNumber are required' }, { status: 400 })
  }

  try {
    const tenant = await db.tenant.create({
      data: {
        businessName: businessName.trim(),
        businessType: businessType?.trim() || 'bakery',
        ownerPhone: ownerPhone.trim(),
        whatsappNumber: whatsappNumber.trim(),
        currency: currency?.trim() || 'INR',
      },
    })

    await bootstrapTenant(tenant.id, db)

    return NextResponse.json({ tenantId: tenant.id }, { status: 201 })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'WhatsApp number already registered' }, { status: 409 })
    }
    throw e
  }
}
