import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  const { name, bakery, phone, message } = await req.json()

  const notifyPhone = process.env.CONTACT_NOTIFY_PHONE ?? process.env.BAKER_PHONE
  if (notifyPhone) {
    const text =
      `📬 *New Zesto Lead*\n\n` +
      `Name: ${name}\n` +
      `Bakery: ${bakery}\n` +
      `Phone: ${phone}\n\n` +
      `Message: ${message || '—'}`
    try {
      await sendWhatsApp(notifyPhone, text)
    } catch {
      // Non-fatal — still return success to customer
    }
  }

  return NextResponse.json({ ok: true })
}
