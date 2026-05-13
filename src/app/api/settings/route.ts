import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId } })
  return NextResponse.json(tenant)
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const stringFields = [
    'businessName', 'businessType', 'address', 'logoUrl', 'deliveryDateLabel',
    'timezone', 'openDays', 'openTime', 'closeTime',
    'websiteUrl', 'instagramUrl', 'facebookUrl',
  ]
  const update: Record<string, string | number | boolean> = {}
  for (const key of stringFields) {
    if (data[key] !== undefined) update[key] = data[key]
  }
  if (data.minOrderAmount !== undefined) update.minOrderAmount = Number(data.minOrderAmount)
  if (data.deliveryDateEnabled !== undefined) update.deliveryDateEnabled = Boolean(data.deliveryDateEnabled)

  const tenant = await db.tenant.update({
    where: { id: auth.tenantId },
    data: update,
  })

  return NextResponse.json(tenant)
}
