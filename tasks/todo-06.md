# Task 06 — Bot State Machine (Pure FSM, Fully Tested)

**Phase:** 2 — WhatsApp Bot  
**Goal:** Implement the core ordering bot as a pure function. No DB, no Twilio — just input → output. This is the most important unit in the codebase and must be fully covered by tests.

**Files created:**
- `src/bot/messages.ts`
- `src/bot/state-machine.ts`
- `tests/bot/state-machine.test.ts`

---

The state machine receives the current session state + the customer's message text and returns:
1. The next state to store
2. The reply message(s) to send back

It never touches the DB or Twilio. Those are handled in Task 08.

---

- [ ] **Step 1: Write `src/bot/messages.ts`**

All reply strings live here. Never hardcode strings in state-machine logic.

```typescript
import type { CartItem } from '@/types'

export function formatCurrency(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`
}

export function welcomeMessage(bakeryName: string, welcomeText: string): string {
  return `${welcomeText}\n\nReply with a number to order:\n1. View Menu`
}

export function categoriesMessage(categories: { name: string }[]): string {
  const list = categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
  return `Choose a category:\n\n${list}\n\nOr type *menu* to start over.`
}

export function itemsMessage(
  categoryName: string,
  items: { name: string; price: number; description?: string | null }[]
): string {
  const list = items
    .map((item, i) => {
      const desc = item.description ? `\n   ${item.description}` : ''
      return `${i + 1}. ${item.name} — ${formatCurrency(item.price)}${desc}`
    })
    .join('\n')
  return `*${categoryName}*\n\n${list}\n\nType the number to select, or *back* to go back.`
}

export function askQuantityMessage(itemName: string): string {
  return `How many *${itemName}* would you like? (enter a number)`
}

export function addedToCartMessage(
  itemName: string,
  quantity: number,
  cartTotal: number
): string {
  return `✅ Added ${quantity}x ${itemName} to your order.\n\nCart total: ${formatCurrency(cartTotal)}\n\nAdd more items? Reply *yes* or *no*.`
}

export function orderSummaryMessage(cart: CartItem[]): string {
  const lines = cart.map(
    (item) => `• ${item.quantity}x ${item.name} — ${formatCurrency(item.price * item.quantity)}`
  )
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return `*Your Order:*\n${lines.join('\n')}\n\n*Total: ${formatCurrency(total)}*\n\nConfirm order? Reply *yes* to place or *no* to cancel.`
}

export function orderPlacedMessage(): string {
  return `🎉 Order placed! The baker will review it shortly.\n\nYou'll receive a payment link once it's confirmed.`
}

export function orderRejectedMessage(reason?: string): string {
  const reasonText = reason ? `\nReason: ${reason}` : ''
  return `Sorry, we couldn't accept your order right now.${reasonText}\n\nType *menu* to start a new order.`
}

export function paymentLinkMessage(url: string, amount: number): string {
  return `✅ Your order is confirmed!\n\nPlease pay ${formatCurrency(amount)} here:\n${url}\n\nThank you! 🎂`
}

export function paymentReceivedMessage(): string {
  return `💚 Payment received! Your order is confirmed and will be ready soon. Thank you!`
}

export function invalidInputMessage(): string {
  return `Sorry, I didn't understand that. Please reply with a number from the list, or type *menu* to start over.`
}

export function cancelledMessage(): string {
  return `Order cancelled. Type *menu* to start a new order.`
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/bot/state-machine.test.ts`:

```typescript
import { transition } from '@/bot/state-machine'
import type { BotSessionData } from '@/types'

const categories = [
  { id: 'cat-1', name: 'Cakes', sortOrder: 1, active: true },
  { id: 'cat-2', name: 'Cookies', sortOrder: 2, active: true },
]

const items = [
  { id: 'item-1', categoryId: 'cat-1', name: 'Choc Cake', price: 80000, available: true, sortOrder: 1, description: null, imageUrl: null },
  { id: 'item-2', categoryId: 'cat-1', name: 'Vanilla Cake', price: 70000, available: true, sortOrder: 2, description: null, imageUrl: null },
]

function makeSession(overrides: Partial<BotSessionData> = {}): BotSessionData {
  return {
    customerPhone: '+911234567890',
    state: 'IDLE',
    cart: [],
    ...overrides,
  }
}

describe('transition — IDLE', () => {
  it('any message → AWAITING_CATEGORY, replies with category list', async () => {
    const result = await transition(makeSession({ state: 'IDLE' }), 'hi', { categories, items })
    expect(result.nextState).toBe('AWAITING_CATEGORY')
    expect(result.replies[0]).toContain('Cakes')
    expect(result.replies[0]).toContain('Cookies')
  })
})

describe('transition — AWAITING_CATEGORY', () => {
  it('valid category number → AWAITING_ITEM, shows items', async () => {
    const result = await transition(makeSession({ state: 'AWAITING_CATEGORY' }), '1', { categories, items })
    expect(result.nextState).toBe('AWAITING_ITEM')
    expect(result.replies[0]).toContain('Choc Cake')
    expect(result.context?.selectedCategoryId).toBe('cat-1')
  })

  it('invalid number → stays AWAITING_CATEGORY, sends error', async () => {
    const result = await transition(makeSession({ state: 'AWAITING_CATEGORY' }), '99', { categories, items })
    expect(result.nextState).toBe('AWAITING_CATEGORY')
    expect(result.replies[0]).toContain("didn't understand")
  })

  it('"menu" → IDLE', async () => {
    const result = await transition(makeSession({ state: 'AWAITING_CATEGORY' }), 'menu', { categories, items })
    expect(result.nextState).toBe('IDLE')
  })
})

describe('transition — AWAITING_ITEM', () => {
  it('valid item number → AWAITING_QUANTITY, asks how many', async () => {
    const session = makeSession({ state: 'AWAITING_ITEM', cart: [] })
    session.context = { selectedCategoryId: 'cat-1' }
    const result = await transition(session, '1', { categories, items })
    expect(result.nextState).toBe('AWAITING_QUANTITY')
    expect(result.replies[0]).toContain('Choc Cake')
    expect(result.context?.pendingItem?.id).toBe('item-1')
  })

  it('"back" → AWAITING_CATEGORY', async () => {
    const session = makeSession({ state: 'AWAITING_ITEM' })
    session.context = { selectedCategoryId: 'cat-1' }
    const result = await transition(session, 'back', { categories, items })
    expect(result.nextState).toBe('AWAITING_CATEGORY')
  })
})

describe('transition — AWAITING_QUANTITY', () => {
  it('valid number → AWAITING_MORE, item added to cart', async () => {
    const session = makeSession({ state: 'AWAITING_QUANTITY', cart: [] })
    session.context = { pendingItem: items[0] }
    const result = await transition(session, '2', { categories, items })
    expect(result.nextState).toBe('AWAITING_MORE')
    expect(result.updatedCart).toHaveLength(1)
    expect(result.updatedCart![0].quantity).toBe(2)
  })

  it('zero or negative → stays AWAITING_QUANTITY, sends error', async () => {
    const session = makeSession({ state: 'AWAITING_QUANTITY', cart: [] })
    session.context = { pendingItem: items[0] }
    const result = await transition(session, '0', { categories, items })
    expect(result.nextState).toBe('AWAITING_QUANTITY')
  })

  it('non-number → stays AWAITING_QUANTITY, sends error', async () => {
    const session = makeSession({ state: 'AWAITING_QUANTITY', cart: [] })
    session.context = { pendingItem: items[0] }
    const result = await transition(session, 'five', { categories, items })
    expect(result.nextState).toBe('AWAITING_QUANTITY')
  })
})

describe('transition — AWAITING_MORE', () => {
  const cart = [{ menuItemId: 'item-1', name: 'Choc Cake', price: 80000, quantity: 1 }]

  it('"yes" → AWAITING_CATEGORY', async () => {
    const result = await transition(makeSession({ state: 'AWAITING_MORE', cart }), 'yes', { categories, items })
    expect(result.nextState).toBe('AWAITING_CATEGORY')
  })

  it('"no" → AWAITING_CONFIRMATION, shows order summary', async () => {
    const result = await transition(makeSession({ state: 'AWAITING_MORE', cart }), 'no', { categories, items })
    expect(result.nextState).toBe('AWAITING_CONFIRMATION')
    expect(result.replies[0]).toContain('Choc Cake')
    expect(result.replies[0]).toContain('₹800')
  })
})

describe('transition — AWAITING_CONFIRMATION', () => {
  const cart = [{ menuItemId: 'item-1', name: 'Choc Cake', price: 80000, quantity: 1 }]

  it('"yes" → ORDER_PENDING, returns shouldCreateOrder=true', async () => {
    const result = await transition(makeSession({ state: 'AWAITING_CONFIRMATION', cart }), 'yes', { categories, items })
    expect(result.nextState).toBe('ORDER_PENDING')
    expect(result.shouldCreateOrder).toBe(true)
    expect(result.replies[0]).toContain('placed')
  })

  it('"no" → IDLE, order cancelled', async () => {
    const result = await transition(makeSession({ state: 'AWAITING_CONFIRMATION', cart }), 'no', { categories, items })
    expect(result.nextState).toBe('IDLE')
    expect(result.replies[0]).toContain('cancelled')
  })
})

describe('"menu" resets from any state', () => {
  const states = ['AWAITING_ITEM', 'AWAITING_QUANTITY', 'AWAITING_MORE', 'AWAITING_CONFIRMATION'] as const
  it.each(states)('from %s → IDLE', async (state) => {
    const result = await transition(makeSession({ state }), 'menu', { categories, items })
    expect(result.nextState).toBe('IDLE')
  })
})
```

- [ ] **Step 3: Run to verify failures**

```bash
npm test tests/bot/state-machine.test.ts
```

Expected: FAIL — `Cannot find module '@/bot/state-machine'`

- [ ] **Step 4: Write `src/bot/state-machine.ts`**

```typescript
import type { BotSessionData, CartItem, BotState } from '@/types'
import {
  categoriesMessage,
  itemsMessage,
  askQuantityMessage,
  addedToCartMessage,
  orderSummaryMessage,
  orderPlacedMessage,
  cancelledMessage,
  invalidInputMessage,
} from './messages'

type MenuCategory = { id: string; name: string; sortOrder: number; active: boolean }
type MenuItem = { id: string; categoryId: string; name: string; price: number; available: boolean; sortOrder: number; description: string | null; imageUrl: string | null }

interface TransitionContext {
  categories: MenuCategory[]
  items: MenuItem[]
}

export interface TransitionResult {
  nextState: BotState
  replies: string[]
  updatedCart?: CartItem[]
  context?: Record<string, unknown>
  shouldCreateOrder?: boolean
}

type SessionWithContext = BotSessionData & { context?: Record<string, unknown> }

function normalize(text: string): string {
  return text.trim().toLowerCase()
}

export async function transition(
  session: SessionWithContext,
  rawInput: string,
  ctx: TransitionContext
): Promise<TransitionResult> {
  const input = normalize(rawInput)
  const { categories, items } = ctx

  // Global reset
  if (input === 'menu' || input === 'restart') {
    return { nextState: 'IDLE', replies: [categoriesMessage(categories.filter(c => c.active))] }
  }

  switch (session.state) {
    case 'IDLE':
    case 'ORDER_PENDING': {
      const activeCategories = categories.filter(c => c.active)
      return {
        nextState: 'AWAITING_CATEGORY',
        replies: [categoriesMessage(activeCategories)],
      }
    }

    case 'AWAITING_CATEGORY': {
      const activeCategories = categories.filter(c => c.active)
      const index = parseInt(input) - 1
      if (isNaN(index) || index < 0 || index >= activeCategories.length) {
        return {
          nextState: 'AWAITING_CATEGORY',
          replies: [invalidInputMessage()],
        }
      }
      const selectedCategory = activeCategories[index]
      const categoryItems = items.filter(i => i.categoryId === selectedCategory.id && i.available)
      return {
        nextState: 'AWAITING_ITEM',
        replies: [itemsMessage(selectedCategory.name, categoryItems)],
        context: { selectedCategoryId: selectedCategory.id },
      }
    }

    case 'AWAITING_ITEM': {
      if (input === 'back') {
        const activeCategories = categories.filter(c => c.active)
        return {
          nextState: 'AWAITING_CATEGORY',
          replies: [categoriesMessage(activeCategories)],
        }
      }
      const selectedCategoryId = session.context?.selectedCategoryId as string
      const categoryItems = items.filter(i => i.categoryId === selectedCategoryId && i.available)
      const index = parseInt(input) - 1
      if (isNaN(index) || index < 0 || index >= categoryItems.length) {
        return {
          nextState: 'AWAITING_ITEM',
          replies: [invalidInputMessage()],
          context: session.context,
        }
      }
      const pendingItem = categoryItems[index]
      return {
        nextState: 'AWAITING_QUANTITY',
        replies: [askQuantityMessage(pendingItem.name)],
        context: { ...session.context, pendingItem },
      }
    }

    case 'AWAITING_QUANTITY': {
      const qty = parseInt(input)
      if (isNaN(qty) || qty <= 0) {
        return {
          nextState: 'AWAITING_QUANTITY',
          replies: [invalidInputMessage()],
          context: session.context,
        }
      }
      const pendingItem = session.context?.pendingItem as MenuItem
      const existingIndex = session.cart.findIndex(c => c.menuItemId === pendingItem.id)
      let updatedCart: CartItem[]
      if (existingIndex >= 0) {
        updatedCart = session.cart.map((item, i) =>
          i === existingIndex ? { ...item, quantity: item.quantity + qty } : item
        )
      } else {
        updatedCart = [
          ...session.cart,
          { menuItemId: pendingItem.id, name: pendingItem.name, price: pendingItem.price, quantity: qty },
        ]
      }
      const cartTotal = updatedCart.reduce((sum, i) => sum + i.price * i.quantity, 0)
      return {
        nextState: 'AWAITING_MORE',
        replies: [addedToCartMessage(pendingItem.name, qty, cartTotal)],
        updatedCart,
        context: {},
      }
    }

    case 'AWAITING_MORE': {
      if (input === 'yes' || input === 'y') {
        const activeCategories = categories.filter(c => c.active)
        return {
          nextState: 'AWAITING_CATEGORY',
          replies: [categoriesMessage(activeCategories)],
        }
      }
      if (input === 'no' || input === 'n') {
        return {
          nextState: 'AWAITING_CONFIRMATION',
          replies: [orderSummaryMessage(session.cart)],
        }
      }
      return {
        nextState: 'AWAITING_MORE',
        replies: [invalidInputMessage()],
      }
    }

    case 'AWAITING_CONFIRMATION': {
      if (input === 'yes' || input === 'y' || input === 'confirm') {
        return {
          nextState: 'ORDER_PENDING',
          replies: [orderPlacedMessage()],
          shouldCreateOrder: true,
        }
      }
      if (input === 'no' || input === 'n' || input === 'cancel') {
        return {
          nextState: 'IDLE',
          replies: [cancelledMessage()],
          updatedCart: [],
        }
      }
      return {
        nextState: 'AWAITING_CONFIRMATION',
        replies: [invalidInputMessage()],
      }
    }

    default:
      return { nextState: 'IDLE', replies: [categoriesMessage(categories)] }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test tests/bot/state-machine.test.ts
```

Expected: All tests pass. If any fail, read the error — it will point to the exact state/input pair that's wrong.

- [ ] **Step 6: Commit**

```bash
git add src/bot/state-machine.ts src/bot/messages.ts tests/bot/state-machine.test.ts
git commit -m "feat: implement bot state machine with full test coverage"
```
