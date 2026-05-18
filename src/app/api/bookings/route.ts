import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromCookies } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // optional filter

  const where = {
    tenantId: auth.tenantId,
    ...(status ? { status: status as 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' } : {}),
  }

  const bookings = await db.booking.findMany({
    where,
    include: {
      order: { include: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ bookings })
}
