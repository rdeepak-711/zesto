import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, isCustom } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  const count = await db.menuCategory.count({ where: { tenantId: auth.tenantId } })
  const category = await db.menuCategory.create({
    data: { tenantId: auth.tenantId, name: name.trim(), sortOrder: count, isCustom: !!isCustom },
    include: { items: true },
  })
  return NextResponse.json(category, { status: 201 })
}
