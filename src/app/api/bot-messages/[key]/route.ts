import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const { value } = await req.json()
  if (typeof value !== 'string' || value.trim() === '') {
    return NextResponse.json({ error: 'value required' }, { status: 400 })
  }
  const updated = await db.botMessage.update({ where: { key }, data: { value } })
  return NextResponse.json(updated)
}
