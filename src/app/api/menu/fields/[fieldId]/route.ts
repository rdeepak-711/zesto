import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ fieldId: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fieldId } = await params
  const body = await req.json()
  const result = await db.categoryField.updateMany({
    where: { id: fieldId, tenantId: auth.tenantId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.required !== undefined && { required: body.required }),
      ...(body.placeholder !== undefined && { placeholder: body.placeholder }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ fieldId: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fieldId } = await params
  // Verify ownership before any deletes
  const field = await db.categoryField.findFirst({ where: { id: fieldId, tenantId: auth.tenantId } })
  if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await db.itemFieldOption.deleteMany({ where: { fieldId } })
  await db.categoryFieldOption.deleteMany({ where: { fieldId } })
  await db.categoryField.delete({ where: { id: fieldId } })
  return new NextResponse(null, { status: 204 })
}
