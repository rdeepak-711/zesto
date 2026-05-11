import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const data = await req.json()

  const result = await db.menuItem.updateMany({
    where: { id, tenantId: auth.tenantId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.price !== undefined && { price: Math.round(data.price) }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.productUrl !== undefined && { productUrl: data.productUrl }),
      ...(data.available !== undefined && { available: data.available }),
    },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await db.menuItem.deleteMany({ where: { id, tenantId: auth.tenantId } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
