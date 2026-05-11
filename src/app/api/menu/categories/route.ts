import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { name, isCustom } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  const count = await db.menuCategory.count()
  const category = await db.menuCategory.create({
    data: { name: name.trim(), sortOrder: count, isCustom: !!isCustom },
    include: { items: true },
  })
  return NextResponse.json(category, { status: 201 })
}
