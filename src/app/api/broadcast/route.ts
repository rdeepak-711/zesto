import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  // Get unique customers
  const customers = await db.order.groupBy({
    by: ['customerPhone'],
  })

  const broadcast = await db.broadcast.create({
    data: { message: message.trim(), sentCount: 0, failedCount: 0 },
  })

  let sentCount = 0
  let failedCount = 0
  const failures: string[] = []

  for (const c of customers) {
    try {
      const msg = await sendWhatsApp(c.customerPhone, message.trim())
      // Twilio returns success even for undelivered sandbox messages.
      // Log the SID so you can look it up in the Twilio console.
      console.log(`Broadcast to ${c.customerPhone} SID=${msg.sid} status=${msg.status}`)
      sentCount++
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`Broadcast failed for ${c.customerPhone}:`, detail)
      failures.push(`${c.customerPhone}: ${detail}`)
      failedCount++
    }
  }

  const updated = await db.broadcast.update({
    where: { id: broadcast.id },
    data: { sentCount, failedCount },
  })

  return NextResponse.json({ ...updated, failures })
}
