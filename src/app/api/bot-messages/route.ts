import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const messages = await db.botMessage.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { key: 'asc' },
  })
  return NextResponse.json(messages)
}
