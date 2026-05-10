import { describe, it, expect } from 'vitest'
import { processMessage, type BotInput } from '@/lib/bot/fsm'

const categories = [
  { id: 'cat-cakes', name: 'Cakes', sortOrder: 1 },
  { id: 'cat-pastries', name: 'Pastries', sortOrder: 2 },
]

const menuItems = [
  { id: 'item-choc', name: 'Chocolate Cake', price: 80000, categoryId: 'cat-cakes' },
  { id: 'item-vanilla', name: 'Vanilla Cake', price: 70000, categoryId: 'cat-cakes' },
  { id: 'item-croissant', name: 'Butter Croissant', price: 8000, categoryId: 'cat-pastries' },
]

function makeInput(overrides: Partial<BotInput>): BotInput {
  return {
    message: '',
    state: 'IDLE',
    cart: [],
    context: {},
    categories,
    menuItems,
    messages: {},
    ...overrides,
  }
}

describe('FSM global commands', () => {
  it('returns category list on "menu" in any state', () => {
    const out = processMessage(makeInput({ message: 'menu', state: 'ORDER_PENDING' }))
    expect(out.nextState).toBe('AWAITING_CATEGORY')
    expect(out.reply).toContain('Our Menu')
    expect(out.cart).toHaveLength(0)
  })

  it('returns welcome + category list on "hi"', () => {
    const out = processMessage(makeInput({ message: 'hi', state: 'IDLE' }))
    expect(out.nextState).toBe('AWAITING_CATEGORY')
    expect(out.reply).toContain('Welcome')
    expect(out.cart).toHaveLength(0)
  })

  it('cancels and resets on "cancel"', () => {
    const out = processMessage(
      makeInput({ message: 'cancel', state: 'AWAITING_MORE', cart: [{ menuItemId: 'item-choc', name: 'Chocolate Cake', price: 80000, quantity: 1 }] })
    )
    expect(out.nextState).toBe('IDLE')
    expect(out.cart).toHaveLength(0)
  })
})

describe('FSM AWAITING_CATEGORY', () => {
  it('selects category by number', () => {
    const out = processMessage(makeInput({ message: '1', state: 'AWAITING_CATEGORY' }))
    expect(out.nextState).toBe('AWAITING_ITEM')
    expect(out.context.selectedCategoryId).toBe('cat-cakes')
  })

  it('selects category by name (case insensitive)', () => {
    const out = processMessage(makeInput({ message: 'pastries', state: 'AWAITING_CATEGORY' }))
    expect(out.nextState).toBe('AWAITING_ITEM')
    expect(out.context.selectedCategoryId).toBe('cat-pastries')
  })

  it('rejects invalid category', () => {
    const out = processMessage(makeInput({ message: 'burgers', state: 'AWAITING_CATEGORY' }))
    expect(out.nextState).toBe('AWAITING_CATEGORY')
    expect(out.reply).toContain('choose a category')
  })
})

describe('FSM AWAITING_ITEM', () => {
  it('selects item by number and asks for quantity', () => {
    const out = processMessage(
      makeInput({ message: '1', state: 'AWAITING_ITEM', context: { selectedCategoryId: 'cat-cakes' } })
    )
    expect(out.nextState).toBe('AWAITING_QUANTITY')
    expect(out.context.selectedItemId).toBe('item-choc')
    expect(out.context.selectedItemPrice).toBe(80000)
  })
})

describe('FSM AWAITING_QUANTITY', () => {
  it('adds item to cart', () => {
    const out = processMessage(
      makeInput({
        message: '2',
        state: 'AWAITING_QUANTITY',
        context: {
          selectedCategoryId: 'cat-cakes',
          selectedItemId: 'item-choc',
          selectedItemName: 'Chocolate Cake',
          selectedItemPrice: 80000,
        },
      })
    )
    expect(out.nextState).toBe('AWAITING_MORE')
    expect(out.cart).toHaveLength(1)
    expect(out.cart[0].quantity).toBe(2)
    expect(out.cart[0].price).toBe(80000)
  })

  it('increments quantity if same item already in cart', () => {
    const existing = [{ menuItemId: 'item-choc', name: 'Chocolate Cake', price: 80000, quantity: 1 }]
    const out = processMessage(
      makeInput({
        message: '3',
        state: 'AWAITING_QUANTITY',
        cart: existing,
        context: {
          selectedItemId: 'item-choc',
          selectedItemName: 'Chocolate Cake',
          selectedItemPrice: 80000,
        },
      })
    )
    expect(out.cart[0].quantity).toBe(4)
  })

  it('rejects invalid quantity', () => {
    const out = processMessage(
      makeInput({ message: '0', state: 'AWAITING_QUANTITY', context: { selectedItemId: 'item-choc' } })
    )
    expect(out.nextState).toBe('AWAITING_QUANTITY')
    expect(out.reply).toContain('valid quantity')
  })
})

describe('FSM AWAITING_CONFIRMATION', () => {
  const cart = [{ menuItemId: 'item-choc', name: 'Chocolate Cake', price: 80000, quantity: 1 }]

  it('places order on confirm', () => {
    const out = processMessage(makeInput({ message: 'confirm', state: 'AWAITING_CONFIRMATION', cart }))
    expect(out.placeOrder).toBe(true)
    expect(out.nextState).toBe('ORDER_PENDING')
  })

  it('cancels on no', () => {
    const out = processMessage(makeInput({ message: 'no', state: 'AWAITING_CONFIRMATION', cart }))
    expect(out.placeOrder).toBe(false)
    expect(out.nextState).toBe('IDLE')
    expect(out.cart).toHaveLength(0)
  })
})
