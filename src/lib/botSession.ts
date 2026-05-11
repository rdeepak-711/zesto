import { db } from '@/lib/db'

export type CartItem = {
  menuItemId: string
  name: string
  price: number
  quantity: number
  variantName?: string
}

export type BotContext = {
  selectedCategoryId?: string
  selectedItemId?: string
  selectedItemName?: string
  selectedItemPrice?: number
  selectedVariantName?: string
  selectedVariantDelta?: number
  customerName?: string
  customDescription?: string
  deliveryNote?: string
  appliedCode?: string
  appliedDiscount?: number
  paymentMethod?: 'ONLINE' | 'COD'
  nudgedAt?: string
}

export type BotSession = {
  id: string
  customerPhone: string
  state: string
  cart: CartItem[]
  context: BotContext
}

export async function getSession(customerPhone: string, tenantId: string): Promise<BotSession> {
  const row = await db.botSession.upsert({
    where: { customerPhone_tenantId: { customerPhone, tenantId } },
    update: {},
    create: { customerPhone, tenantId },
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
  context: BotContext,
  tenantId: string
) {
  await db.botSession.update({
    where: { customerPhone_tenantId: { customerPhone, tenantId } },
    data: {
      state,
      cartJson: JSON.stringify(cart),
      contextJson: JSON.stringify(context),
    },
  })
}

export async function resetSession(customerPhone: string, tenantId: string) {
  await db.botSession.update({
    where: { customerPhone_tenantId: { customerPhone, tenantId } },
    data: {
      state: 'IDLE',
      cartJson: '[]',
      contextJson: '{}',
    },
  })
}
