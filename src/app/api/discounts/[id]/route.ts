import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const result = await db.discountCode.updateMany({
    where: { id: Number(id), tenantId: auth.tenantId },
    data: {
      ...(body.code !== undefined && { code: body.code }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.value !== undefined && { value: Number(body.value) }),
      ...(body.minAmount !== undefined && { minAmount: Number(body.minAmount) }),
      ...(body.maxUses !== undefined && { maxUses: Number(body.maxUses) }),
      ...(body.active !== undefined && { active: Boolean(body.active) }),
      ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
    },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await db.discountCode.deleteMany({ where: { id: Number(id), tenantId: auth.tenantId } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
