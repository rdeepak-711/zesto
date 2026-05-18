import { db } from '@/lib/db'

export type FieldSelection = {
  name: string
  value: string
  priceDelta: number
}

export type FieldDef = {
  id: string
  name: string
  type: 'text' | 'number' | 'select' | 'boolean'
  required: boolean
  placeholder?: string
  options: { id: string; label: string; priceDelta: number }[]
}

export type CartItem = {
  menuItemId: string
  name: string
  price: number      // base price in paise (NOT including field deltas)
  quantity: number
  fields: FieldSelection[]
}

export type BotContext = {
  selectedCategoryId?: string
  selectedItemId?: string
  selectedItemName?: string
  selectedItemPrice?: number
  customerName?: string
  customDescription?: string
  deliveryNote?: string
  appliedCode?: string
  appliedDiscount?: number
  paymentMethod?: 'ONLINE' | 'COD'
  nudgedAt?: string
  // field collection — replaces selectedVariantName/selectedVariantDelta
  pendingFields?: FieldDef[]
  collectedFields?: FieldSelection[]
  // order selection state (track / cancel list)
  trackOrderIds?: string[]
  cancelOrderIds?: string[]
  // booking flow fields
  customerAge?: number
  bookingDate?: string
  bookingTime?: string
}

export type BotSession = {
  id: string
  customerPhone: string
  state: string
  cart: CartItem[]
  context: BotContext
  lastActive: Date
}

const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000 // 4 hours

export function isSessionStale(state: string, lastActive: Date): boolean {
  if (state === 'IDLE' || state === 'ORDER_PENDING') return false
  return Date.now() - lastActive.getTime() > STALE_THRESHOLD_MS
}

export async function getSession(customerPhone: string, tenantId: string): Promise<BotSession> {
  const row = await db.botSession.upsert({
    where: { customerPhone_tenantId: { customerPhone, tenantId } },
    update: {},
    create: { customerPhone, tenantId, contextJson: '{}', cartJson: '[]' },
  })

  // Backward-compat: old sessions may have variantName instead of fields
  const rawCart = JSON.parse(row.cartJson || '[]') as Record<string, unknown>[]
  const cart: CartItem[] = rawCart.map(i => ({
    menuItemId: i.menuItemId as string,
    name: i.name as string,
    price: i.price as number,
    quantity: i.quantity as number,
    fields: Array.isArray(i.fields) ? i.fields as FieldSelection[] : [],
  }))

  const rawContext = JSON.parse(row.contextJson || '{}') as Record<string, unknown>
  // Strip legacy variant fields from old sessions
  delete rawContext.selectedVariantName
  delete rawContext.selectedVariantDelta
  const context = rawContext as BotContext

  return {
    id: row.id,
    customerPhone: row.customerPhone,
    state: row.state,
    cart,
    context,
    lastActive: row.lastActive,
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
    data: { state: 'IDLE', cartJson: '[]', contextJson: '{}' },
  })
}
