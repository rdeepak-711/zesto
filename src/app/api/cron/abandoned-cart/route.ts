import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/twilio'

const ABANDON_AFTER_MS = 2 * 60 * 60 * 1000 // 2 hours

const NUDGE_STATES = ['AWAITING_CONFIRMATION', 'AWAITING_DELIVERY_DATE', 'AWAITING_CUSTOM_CONFIRM']

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

function buildNudge(state: string, cart: { name: string; quantity: number; price: number; variantName?: string }[]): string {
  if (state === 'AWAITING_CUSTOM_CONFIRM') {
    return `👋 Hey! You were describing a custom order but didn't finish.\n\nType *yes* to confirm your request, or *hi* to start fresh.`
  }

  if (cart.length === 0) {
    return `👋 Hey! You left before finishing your order.\n\nType *hi* to start fresh anytime.`
  }

  const cartLines = cart
    .map(i => `• ${i.name}${i.variantName ? ` (${i.variantName})` : ''} × ${i.quantity} — ${formatPrice(i.price * i.quantity)}`)
    .join('\n')

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  if (state === 'AWAITING_DELIVERY_DATE') {
    return `👋 Hey! You left your order before adding a delivery date.\n\n${cartLines}\n\n*Total: ${formatPrice(total)}*\n\nJust reply with your preferred delivery date to continue!`
  }

  return `👋 Hey! You left some items in your cart:\n\n${cartLines}\n\n*Total: ${formatPrice(total)}*\n\nReply *yes* to confirm your order or *hi* to start fresh.`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS)

  const staleSessions = await db.botSession.findMany({
    where: {
      state: { in: NUDGE_STATES },
      lastActive: { lt: cutoff },
    },
  })

  let nudged = 0
  let skipped = 0
  const errors: string[] = []

  for (const session of staleSessions) {
    const context = JSON.parse(session.contextJson || '{}')

    if (context.nudgedAt) {
      skipped++
      continue
    }

    const cart = JSON.parse(session.cartJson || '[]')
    const message = buildNudge(session.state, cart)

    try {
      await sendWhatsApp(session.customerPhone, message)

      await db.botSession.update({
        where: { id: session.id },
        data: { contextJson: JSON.stringify({ ...context, nudgedAt: new Date().toISOString() }) },
      })

      nudged++
    } catch (err) {
      errors.push(`${session.customerPhone}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ nudged, skipped, errors, total: staleSessions.length })
}
