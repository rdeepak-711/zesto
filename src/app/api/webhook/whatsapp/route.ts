import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, saveSession, resetSession } from '@/lib/botSession'
import { processMessage, type BotState } from '@/lib/bot/fsm'
import { sendWhatsApp } from '@/lib/twilio'
import { notifyBaker } from '@/lib/bakerNotify'

async function handleBakerReply(body: string, bakerPhone: string, config: { bakerPhone: string }) {
  const upper = body.trim().toUpperCase()
  const acceptMatch = upper.match(/^ACCEPT\s+([A-Z0-9]{8})/)
  const rejectMatch = upper.match(/^REJECT\s+([A-Z0-9]{8})/)

  if (acceptMatch) {
    const shortId = acceptMatch[1].toLowerCase()
    const order = await db.order.findFirst({ where: { id: { startsWith: shortId } } })

    if (!order || order.status !== 'PENDING') {
      await sendWhatsApp(bakerPhone, `Order ${shortId.toUpperCase()} not found or already processed.`)
      return
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
    const order = await db.order.findFirst({ where: { id: { startsWith: shortId } } })

    if (!order || order.status !== 'PENDING') {
      await sendWhatsApp(bakerPhone, `Order ${shortId.toUpperCase()} not found or already processed.`)
      return
    }

    await db.order.update({ where: { id: order.id }, data: { status: 'REJECTED' } })

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
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const body = formData.get('Body')?.toString().trim() ?? ''
  const rawFrom = formData.get('From')?.toString() ?? ''
  const customerPhone = rawFrom.replace('whatsapp:', '')

  if (!customerPhone) return new NextResponse('Bad Request', { status: 400 })

  const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })

  // Baker reply — route to accept/reject handler
  if (config && customerPhone === config.bakerPhone) {
    await handleBakerReply(body, customerPhone, config)
    return new NextResponse('', { status: 200 })
  }

  // Customer message — run bot FSM
  const [session, categories, menuItems, botMessageRows, rules] = await Promise.all([
    getSession(customerPhone),
    db.menuCategory.findMany({ where: { active: true }, select: { id: true, name: true, sortOrder: true, isCustom: true } }),
    db.menuItem.findMany({ where: { available: true } }),
    db.botMessage.findMany(),
    db.botRule.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ])

  const messages = Object.fromEntries(botMessageRows.map((r) => [r.key, r.value]))

  await db.message.create({ data: { customerPhone, body, direction: 'IN' } })

  const output = processMessage({
    message: body,
    state: session.state as BotState,
    cart: session.cart,
    context: session.context,
    categories,
    menuItems,
    messages,
    rules,
  })

  if (output.placeOrder) {
    const isCustom = !!output.context.customDescription
    const customDescription = output.context.customDescription

    // Optionally rephrase with AI if key present
    let finalDescription = customDescription
    if (isCustom && process.env.OPENROUTER_API_KEY && customDescription) {
      try {
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-lite',
            messages: [
              {
                role: 'system',
                content: 'You are an assistant for a bakery. Reformat the customer\'s custom order request into a clear, structured summary for the baker. Keep all details. Use bullet points. Be concise. No extra commentary.',
              },
              { role: 'user', content: customDescription },
            ],
            max_tokens: 300,
          }),
        })
        const aiJson = await aiRes.json()
        finalDescription = aiJson.choices?.[0]?.message?.content ?? customDescription
      } catch {
        // AI failed — use raw description
      }
    }

    const prevOrder = await db.order.findFirst({
      where: { customerPhone },
      orderBy: { createdAt: 'desc' },
    })

    let order
    if (isCustom && finalDescription) {
      order = await db.order.create({
        data: {
          customerPhone,
          customerName: prevOrder?.customerName ?? 'WhatsApp Customer',
          totalAmount: 0,
          notes: finalDescription,
          items: {
            create: [{
              menuItemId: 'item-custom',
              name: 'Custom Order',
              price: 0,
              quantity: 1,
            }],
          },
        },
      })
      if (config) {
        await notifyBaker(order.id, [{ menuItemId: 'custom', name: `Custom Order: ${finalDescription}`, price: 0, quantity: 1 }], 0, customerPhone, config.bakerPhone)
      }
    } else if (output.cart.length > 0) {
      const totalAmount = output.cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
      order = await db.order.create({
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
      if (config) {
        await notifyBaker(order.id, output.cart, totalAmount, customerPhone, config.bakerPhone)
      }
    }

    await resetSession(customerPhone)
  } else {
    await saveSession(customerPhone, output.nextState, output.cart, output.context)
  }

  await db.message.create({ data: { customerPhone, body: output.reply, direction: 'OUT' } })
  await sendWhatsApp(customerPhone, output.reply)

  return new NextResponse('', { status: 200 })
}
