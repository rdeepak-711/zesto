import { sendWhatsApp } from '@/lib/twilio'
import type { CartItem } from '@/lib/botSession'
import { itemTotal } from '@/lib/bot/fsm'

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

export type CustomBrief = {
  occasion?: string
  date?: string
  servings?: string
  dietary?: string
  budget?: string
  notes?: string
}

export async function notifyBaker(
  orderId: string,
  cart: CartItem[],
  totalAmount: number,
  customerPhone: string,
  bakerPhone: string,
  fromNumber?: string,
  customBrief?: CustomBrief,
) {
  const shortId = orderId.slice(0, 8).toUpperCase()

  if (customBrief) {
    const lines = [
      customBrief.occasion ? `• *Occasion:* ${customBrief.occasion}` : '',
      customBrief.date ? `• *Date needed:* ${customBrief.date}` : '',
      customBrief.servings ? `• *Serving:* ${customBrief.servings}` : '',
      customBrief.dietary ? `• *Dietary:* ${customBrief.dietary}` : '',
      customBrief.budget ? `• *Budget:* ${customBrief.budget}` : '',
      customBrief.notes ? `• *Notes:* ${customBrief.notes}` : '',
    ].filter(Boolean).join('\n')

    const message =
      `🎂 *New Custom Cake Request!*\n\n` +
      `ID: ${shortId}\n` +
      `📱 ${customerPhone}\n\n` +
      `📋 *Brief:*\n${lines}\n\n` +
      `⏳ Customer awaiting your quote.\n\n` +
      `Reply *orders* to review and respond via dashboard.`

    await sendWhatsApp(bakerPhone, message, fromNumber)
    return
  }

  const itemLines = cart
    .map((item) => {
      const fieldStr = (item.fields ?? []).filter(f => f.value).map(f => f.value).join(', ')
      return `• ${item.name}${fieldStr ? ` (${fieldStr})` : ''} × ${item.quantity} = ${formatPrice(itemTotal(item))}`
    })
    .join('\n')

  const message =
    `🛒 *New Order!*\n\n` +
    `ID: ${shortId}\n` +
    `📱 ${customerPhone}\n\n` +
    `${itemLines}\n\n` +
    `*Total: ${formatPrice(totalAmount)}*\n` +
    `⏳ Reply *orders* to accept or reject`

  await sendWhatsApp(bakerPhone, message, fromNumber)
}
