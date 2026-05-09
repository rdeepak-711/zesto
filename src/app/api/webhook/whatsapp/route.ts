import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, saveSession, resetSession } from '@/lib/botSession'
import { processMessage, type BotState } from '@/lib/bot/fsm'
import { sendWhatsApp } from '@/lib/twilio'
import { notifyBaker } from '@/lib/bakerNotify'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const body = formData.get('Body')?.toString().trim() ?? ''
  const rawFrom = formData.get('From')?.toString() ?? ''
  const customerPhone = rawFrom.replace('whatsapp:', '')

  if (!customerPhone) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const [session, config, categories, menuItems] = await Promise.all([
    getSession(customerPhone),
    db.bakeryConfig.findUnique({ where: { id: 1 } }),
    db.menuCategory.findMany({ where: { active: true } }),
    db.menuItem.findMany({ where: { available: true } }),
  ])

  // Log inbound message
  await db.message.create({
    data: {
      customerPhone,
      body,
      direction: 'IN',
    },
  })

  const output = processMessage({
    message: body,
    state: session.state as BotState,
    cart: session.cart,
    context: session.context,
    categories,
    menuItems,
  })

  // Handle order placement
  if (output.placeOrder && output.cart.length > 0) {
    const totalAmount = output.cart.reduce((sum, i) => sum + i.price * i.quantity, 0)

    // Look up customer name from previous orders
    const prevOrder = await db.order.findFirst({
      where: { customerPhone },
      orderBy: { createdAt: 'desc' },
    })

    const order = await db.order.create({
      data: {
        customerPhone,
        customerName: prevOrder?.customerName ?? 'WhatsApp Customer',
        totalAmount,
        items: {
          create: output.cart.map((item) => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
    })

    // Notify baker
    if (config) {
      await notifyBaker(order.id, output.cart, totalAmount, customerPhone, config.bakerPhone)
    }

    await resetSession(customerPhone)
  } else {
    await saveSession(customerPhone, output.nextState, output.cart, output.context)
  }

  // Log outbound message
  await db.message.create({
    data: {
      customerPhone,
      body: output.reply,
      direction: 'OUT',
    },
  })

  // Send reply via Twilio
  await sendWhatsApp(customerPhone, output.reply)

  // Return empty 200 — Twilio doesn't need a TwiML body when we send separately
  return new NextResponse('', { status: 200 })
}
