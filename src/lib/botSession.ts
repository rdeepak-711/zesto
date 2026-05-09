import { db } from '@/lib/db'

export type CartItem = {
  menuItemId: string
  name: string
  price: number
  quantity: number
}

export type BotContext = {
  selectedCategoryId?: string
  selectedItemId?: string
  selectedItemName?: string
  selectedItemPrice?: number
  customerName?: string
}

export type BotSession = {
  id: string
  customerPhone: string
  state: string
  cart: CartItem[]
  context: BotContext
}

export async function getSession(customerPhone: string): Promise<BotSession> {
  const row = await db.botSession.upsert({
    where: { customerPhone },
    update: {},
    create: { customerPhone },
  })

  return {
    id: row.id,
    customerPhone: row.customerPhone,
    state: row.state,
    cart: JSON.parse(row.cartJson || '[]') as CartItem[],
    context: JSON.parse(row.contextJson || '{}') as BotContext,
  }
}

export async function saveSession(
  customerPhone: string,
  state: string,
  cart: CartItem[],
  context: BotContext
) {
  await db.botSession.update({
    where: { customerPhone },
    data: {
      state,
      cartJson: JSON.stringify(cart),
      contextJson: JSON.stringify(context),
    },
  })
}

export async function resetSession(customerPhone: string) {
  await db.botSession.update({
    where: { customerPhone },
    data: {
      state: 'IDLE',
      cartJson: '[]',
      contextJson: '{}',
    },
  })
}
