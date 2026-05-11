import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, categoryId, price, description, imageUrl, productUrl, available } = await req.json()

  if (!name || !categoryId || price == null) {
    return NextResponse.json({ error: 'name, categoryId and price required' }, { status: 400 })
  }

  const item = await db.menuItem.create({
    data: {
      tenantId: auth.tenantId,
      name,
      categoryId,
      price: Math.round(price),
      description,
      imageUrl,
      productUrl,
      available: available ?? true,
    },
  })

  return NextResponse.json(item, { status: 201 })
}
