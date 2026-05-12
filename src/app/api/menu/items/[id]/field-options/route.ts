import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

// Body: [{ fieldId: string, optionIds: string[] }]
// Empty optionIds = remove overrides for that field (all options visible)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: menuItemId } = await params
  const item = await db.menuItem.findFirst({ where: { id: menuItemId, tenantId: auth.tenantId } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as { fieldId: string; optionIds: string[] }[]

  for (const { fieldId, optionIds } of body) {
    await db.itemFieldOption.deleteMany({ where: { menuItemId, fieldId } })
    for (const optionId of optionIds) {
      await db.itemFieldOption.upsert({
        where: { menuItemId_optionId: { menuItemId, optionId } },
        update: {},
        create: { menuItemId, fieldId, optionId },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
