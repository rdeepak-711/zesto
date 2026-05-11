import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key } = await params
  const { value } = await req.json()
  if (typeof value !== 'string' || value.trim() === '') {
    return NextResponse.json({ error: 'value required' }, { status: 400 })
  }
  const result = await db.botMessage.updateMany({
    where: { key, tenantId: auth.tenantId },
    data: { value },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
