import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rules = await db.botRule.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { label, state, condition, matchText, reply, nextState } = body
  if (!label || !matchText || !reply) {
    return NextResponse.json({ error: 'label, matchText, reply required' }, { status: 400 })
  }
  const count = await db.botRule.count()
  const rule = await db.botRule.create({
    data: {
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
