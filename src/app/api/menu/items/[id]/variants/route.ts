import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const variants = await db.menuItemVariant.findMany({
    where: { menuItemId: id },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(variants)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name, priceDelta = 0 } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  const count = await db.menuItemVariant.count({ where: { menuItemId: id } })
  const variant = await db.menuItemVariant.create({
    data: { menuItemId: id, name: name.trim(), priceDelta: Number(priceDelta), sortOrder: count },
  })
  return NextResponse.json(variant, { status: 201 })
}
