import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const cat = await db.menuCategory.findFirst({ where: { id, tenantId: auth.tenantId } })
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const fields = await db.categoryField.findMany({
    where: { categoryId: id, tenantId: auth.tenantId },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(fields)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const cat = await db.menuCategory.findFirst({ where: { id, tenantId: auth.tenantId } })
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, type, required = true, placeholder, sortOrder = 0 } = body
  if (!name?.trim() || !type) return NextResponse.json({ error: 'name and type required' }, { status: 400 })

  const field = await db.categoryField.create({
    data: { tenantId: auth.tenantId, categoryId: id, name: name.trim(), type, required, placeholder: placeholder || null, sortOrder },
    include: { options: true },
  })
  return NextResponse.json(field, { status: 201 })
}
