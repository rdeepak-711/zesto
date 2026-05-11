import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const category = await db.menuCategory.update({
    where: { id },
    data: body,
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json(category)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const count = await db.menuItem.count({ where: { categoryId: id } })
  if (count > 0) {
    return NextResponse.json({ error: 'Remove all items first' }, { status: 400 })
  }
  await db.menuCategory.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
