import { sendWhatsApp } from '@/lib/twilio'
import type { CartItem } from '@/lib/botSession'

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

export async function notifyBaker(
  orderId: string,
  cart: CartItem[],
  totalAmount: number,
  customerPhone: string,
  bakerPhone: string,
  paymentMethod: string = 'ONLINE'
) {
  const itemLines = cart
    .map((item) => `• ${item.name}${item.variantName ? ` (${item.variantName})` : ''} × ${item.quantity} = ${formatPrice(item.price * item.quantity)}`)
    .join('\n')

  const paymentLine = paymentMethod === 'COD'
    ? `\n💵 *Payment: Cash on Delivery*`
    : totalAmount > 0
      ? `\n💳 Payment: Online`
      : ''

  const shortId = orderId.slice(0, 8).toUpperCase()

  const message =
    `🛒 *New Order!*\n\n` +
    `ID: ${shortId}\n` +
    `📱 ${customerPhone}\n\n` +
    `${itemLines}\n\n` +
    `*Total: ${formatPrice(totalAmount)}*${paymentLine}\n\n` +
    `Type *orders* to manage`

  await sendWhatsApp(bakerPhone, message)
}
