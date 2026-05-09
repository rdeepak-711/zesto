import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const body = formData.get('Body')?.toString().trim().toUpperCase() ?? ''
  const rawFrom = formData.get('From')?.toString() ?? ''
  const bakerPhone = rawFrom.replace('whatsapp:', '')

  const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })
  if (!config || config.bakerPhone !== bakerPhone) {
    return new NextResponse('', { status: 200 })
  }

  const acceptMatch = body.match(/^ACCEPT\s+([A-Z0-9]{8})/)
  const rejectMatch = body.match(/^REJECT\s+([A-Z0-9]{8})/)

  if (acceptMatch) {
    const shortId = acceptMatch[1].toLowerCase()
    const order = await db.order.findFirst({
      where: { id: { startsWith: shortId } },
    })

    if (!order || order.status !== 'PENDING') {
      await sendWhatsApp(bakerPhone, `Order ${shortId.toUpperCase()} not found or already processed.`)
      return new NextResponse('', { status: 200 })
    }

    await db.order.update({
      where: { id: order.id },
      data: { status: 'ACCEPTED', bakerNotifiedAt: new Date() },
    })

    await sendWhatsApp(
      order.customerPhone,
      `🎉 Your order has been accepted! The baker will prepare it shortly.\n\nWe'll notify you when it's ready. Thank you!`
    )

    await sendWhatsApp(bakerPhone, `✅ Order ${shortId.toUpperCase()} accepted. Customer notified.`)
  } else if (rejectMatch) {
    const shortId = rejectMatch[1].toLowerCase()
    const order = await db.order.findFirst({
      where: { id: { startsWith: shortId } },
    })

    if (!order || order.status !== 'PENDING') {
      await sendWhatsApp(bakerPhone, `Order ${shortId.toUpperCase()} not found or already processed.`)
      return new NextResponse('', { status: 200 })
    }

    await db.order.update({
      where: { id: order.id },
      data: { status: 'REJECTED' },
    })

    await sendWhatsApp(
      order.customerPhone,
      `We're sorry, your order could not be processed at this time. Please try again later or contact us directly.`
    )

    await sendWhatsApp(bakerPhone, `❌ Order ${shortId.toUpperCase()} rejected. Customer notified.`)
  } else {
    await sendWhatsApp(
      bakerPhone,
      `To accept an order: *ACCEPT ORDERID*\nTo reject: *REJECT ORDERID*`
    )
  }

  return new NextResponse('', { status: 200 })
}
