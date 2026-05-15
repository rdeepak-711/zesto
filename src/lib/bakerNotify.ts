import { sendWhatsApp } from '@/lib/twilio'
import type { CartItem } from '@/lib/botSession'
import { itemTotal } from '@/lib/bot/fsm'

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

export async function notifyBaker(
  orderId: string,
  cart: CartItem[],
  totalAmount: number,
  customerPhone: string,
  bakerPhone: string,
) {
  const itemLines = cart
    .map((item) => {
      const fieldStr = (item.fields ?? []).filter(f => f.value).map(f => f.value).join(', ')
      return `• ${item.name}${fieldStr ? ` (${fieldStr})` : ''} × ${item.quantity} = ${formatPrice(itemTotal(item))}`
    })
    .join('\n')

  const shortId = orderId.slice(0, 8).toUpperCase()

  const message =
    `🛒 *New Order!*\n\n` +
    `ID: ${shortId}\n` +
    `📱 ${customerPhone}\n\n` +
    `${itemLines}\n\n` +
    `*Total: ${formatPrice(totalAmount)}*\n` +
    `⏳ Awaiting payment (sent after you accept)\n\n` +
    `Reply *1* to accept or *2* to reject`

  await sendWhatsApp(bakerPhone, message)
}
