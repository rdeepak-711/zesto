import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rules = await db.botRule.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { label, state, condition, matchText, reply, nextState } = body
  if (!label || !matchText || !reply) {
    return NextResponse.json({ error: 'label, matchText, reply required' }, { status: 400 })
  }
  const count = await db.botRule.count({ where: { tenantId: auth.tenantId } })
  const rule = await db.botRule.create({
    data: {
      tenantId: auth.tenantId,
      label,
      state: state ?? '*',
      condition: condition ?? 'contains',
      matchText,
      reply,
      nextState: nextState ?? 'SAME',
      sortOrder: count,
    },
  })
  return NextResponse.json(rule, { status: 201 })
}
