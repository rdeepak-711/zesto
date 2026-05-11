import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import { sendWhatsApp } from '@/lib/twilio'

export type BroadcastSegment = 'all' | 'new' | 'repeat' | 'high_value' | 'inactive'

async function getSegmentPhones(segment: BroadcastSegment, tenantId: string): Promise<string[]> {
  if (segment === 'all') {
    const rows = await db.order.groupBy({ by: ['customerPhone'], where: { tenantId } })
    return rows.map(r => r.customerPhone)
  }

  if (segment === 'new') {
    const rows = await db.order.groupBy({
      by: ['customerPhone'],
      where: { tenantId },
      _count: { id: true },
      having: { id: { _count: { equals: 1 } } },
    })
    return rows.map(r => r.customerPhone)
  }

  if (segment === 'repeat') {
    const rows = await db.order.groupBy({
      by: ['customerPhone'],
      where: { tenantId },
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
    })
    return rows.map(r => r.customerPhone)
  }

  if (segment === 'high_value') {
    const rows = await db.order.groupBy({
      by: ['customerPhone'],
      where: { tenantId, status: { in: ['PAID', 'COMPLETED'] } },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    })
    const cutoff = Math.ceil(rows.length * 0.2)
    return rows.slice(0, cutoff).map(r => r.customerPhone)
  }

  if (segment === 'inactive') {
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const active = await db.order.groupBy({
      by: ['customerPhone'],
      where: { tenantId, createdAt: { gte: sixtyDaysAgo } },
    })
    const activePhones = new Set(active.map(r => r.customerPhone))

    const all = await db.order.groupBy({ by: ['customerPhone'], where: { tenantId } })
    return all.map(r => r.customerPhone).filter(p => !activePhones.has(p))
  }

  return []
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const segment = (req.nextUrl.searchParams.get('segment') ?? 'all') as BroadcastSegment
  const phones = await getSegmentPhones(segment, auth.tenantId)
  return NextResponse.json({ count: phones.length })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, segment = 'all' } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const phones = await getSegmentPhones(segment as BroadcastSegment, auth.tenantId)

  const broadcast = await db.broadcast.create({
    data: { tenantId: auth.tenantId, message: message.trim(), sentCount: 0, failedCount: 0 },
  })

  let sentCount = 0
  let failedCount = 0
  const failures: string[] = []

  for (const phone of phones) {
    try {
      const msg = await sendWhatsApp(phone, message.trim())
      console.log(`Broadcast to ${phone} SID=${msg.sid} status=${msg.status}`)
      sentCount++
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`Broadcast failed for ${phone}:`, detail)
      failures.push(`${phone}: ${detail}`)
      failedCount++
    }
  }

  const updated = await db.broadcast.update({
    where: { id: broadcast.id },
    data: { sentCount, failedCount },
  })

  return NextResponse.json({ ...updated, failures })
}
