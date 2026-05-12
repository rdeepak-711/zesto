import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { optionId } = await params
  const body = await req.json()
  const option = await db.categoryFieldOption.findUnique({
    where: { id: optionId },
    include: { field: { select: { tenantId: true } } },
  })
  if (!option || option.field.tenantId !== auth.tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.categoryFieldOption.update({
    where: { id: optionId },
    data: {
      ...(body.label !== undefined && { label: body.label }),
      ...(body.priceDelta !== undefined && { priceDelta: Math.round(body.priceDelta) }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ optionId: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { optionId } = await params
  const option = await db.categoryFieldOption.findUnique({
    where: { id: optionId },
    include: { field: { select: { tenantId: true } } },
  })
  if (!option || option.field.tenantId !== auth.tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.itemFieldOption.deleteMany({ where: { optionId } })
  await db.categoryFieldOption.delete({ where: { id: optionId } })
  return new NextResponse(null, { status: 204 })
}
