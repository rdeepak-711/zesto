import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId } })
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Never expose the payment secret to the browser
  const { razorpayKeySecret: _secret, ...safe } = tenant
  return NextResponse.json(safe)
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const stringFields = [
    'businessName', 'businessType', 'address', 'logoUrl', 'deliveryDateLabel',
    'timezone', 'openDays', 'openTime', 'closeTime',
    'websiteUrl', 'instagramUrl', 'facebookUrl',
    'razorpayKeyId', 'razorpayKeySecret',
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

  const { razorpayKeySecret: _secret, ...safe } = tenant
  return NextResponse.json(safe)
}
