import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })
  return NextResponse.json(config)
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const allowed = ['bakeryName', 'address', 'welcomeMessage', 'logoUrl']
  const update: Record<string, string> = {}
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key]
  }

  const config = await db.bakeryConfig.update({
    where: { id: 1 },
    data: update,
  })

  return NextResponse.json(config)
}
