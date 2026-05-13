import { NextResponse } from 'next/server'
import { getAuthFromCookies } from '@/lib/auth'
import { bootstrapTenant } from '../../../../prisma/bootstrapTenant'
import { db } from '@/lib/db'

export async function POST() {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await bootstrapTenant(auth.tenantId, db)
  return NextResponse.json({ ok: true })
}
