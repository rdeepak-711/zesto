import { sendWhatsApp } from '@/lib/twilio'
import type { CartItem } from '@/lib/botSession'

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`
}

export async function notifyBaker(
  orderId: string,
  cart: CartItem[],
  totalAmount: number,
  customerPhone: string,
  bakerPhone: string
) {
  const itemLines = cart
    .map((item) => `• ${item.name} × ${item.quantity} = ${formatPrice(item.price * item.quantity)}`)
    .join('\n')

  const message =
    `🛒 *New Order Received!*\n\n` +
    `Order ID: ${orderId.slice(0, 8).toUpperCase()}\n` +
    `Customer: ${customerPhone}\n\n` +
    `*Items:*\n${itemLines}\n\n` +
    `*Total: ${formatPrice(totalAmount)}*\n\n` +
    `Reply *ACCEPT ${orderId.slice(0, 8).toUpperCase()}* to accept\n` +
    `Reply *REJECT ${orderId.slice(0, 8).toUpperCase()}* to reject`

  await sendWhatsApp(bakerPhone, message)
}
