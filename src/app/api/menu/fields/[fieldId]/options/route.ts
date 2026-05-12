import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ fieldId: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fieldId } = await params
  const field = await db.categoryField.findFirst({ where: { id: fieldId, tenantId: auth.tenantId } })
  if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { label, priceDelta = 0, sortOrder = 0 } = body
  if (!label?.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 })

  const option = await db.categoryFieldOption.create({
    data: { fieldId, label: label.trim(), priceDelta: Math.round(priceDelta), sortOrder },
  })
  return NextResponse.json(option, { status: 201 })
}
