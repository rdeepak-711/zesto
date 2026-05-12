import { describe, it, expect } from 'vitest'
import { processMessage, type BotInput } from '@/lib/bot/fsm'

const categories = [
  { id: 'cat-cakes', name: 'Cakes', sortOrder: 1, isCustom: false },
  { id: 'cat-pastries', name: 'Pastries', sortOrder: 2, isCustom: false },
]

const menuItems = [
  { id: 'item-choc', name: 'Chocolate Cake', price: 80000, categoryId: 'cat-cakes' },
  { id: 'item-vanilla', name: 'Vanilla Cake', price: 70000, categoryId: 'cat-cakes' },
  { id: 'item-croissant', name: 'Butter Croissant', price: 8000, categoryId: 'cat-pastries' },
]

const defaultMessages = {
  welcome: 'Welcome! {categories}',
  menu_header: 'Our Menu\n\n{categories}',
  invalid_category: "Please choose a category:\n\n{categories}",
  items_footer: 'Reply with a number.',
  invalid_item: 'Please choose a valid item.',
  quantity_prompt: 'How many *{item}* would you like?',
  invalid_quantity: 'Please enter a valid quantity (1–99).',
  item_added: '✅ Added {qty}× *{item}* to your cart.',
  add_more_prompt: 'Add more? Choose a category:\n\n{categories}\n\nOr type *confirm*.',
  choose_more: 'Choose a category:\n\n{categories}\n\nOr type *confirm*.',
  order_summary: '🧾 Order Summary\n\n{cart}\n\nReply *yes* to confirm.',
  order_placed: '🎉 Order placed!',
  order_pending: 'Order being reviewed.',
  cancel: 'Order cancelled.',
  cart_empty: 'Your cart is empty.',
  confirm_hint: 'Type *confirm* to place order.',
  await_confirm: 'Reply *yes* to confirm or *cancel* to start over.',
  back_to_categories: 'Choose a category:\n\n{categories}',
  delivery_date_prompt: '📅 When would you like your order?',
}

function makeInput(overrides: Partial<BotInput>): BotInput {
  return {
    message: '',
    state: 'IDLE',
    cart: [],
    context: {},
    categories,
    menuItems,
    messages: defaultMessages,
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
      makeInput({ message: 'cancel', state: 'AWAITING_MORE', cart: [{ menuItemId: 'item-choc', name: 'Chocolate Cake', price: 80000, quantity: 1, fields: [] }] })
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
    const existing = [{ menuItemId: 'item-choc', name: 'Chocolate Cake', price: 80000, quantity: 1, fields: [] }]
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
  const cart = [{ menuItemId: 'item-choc', name: 'Chocolate Cake', price: 80000, quantity: 1, fields: [] }]

  it('moves to AWAITING_PAYMENT_METHOD on confirm', () => {
    const out = processMessage(makeInput({ message: 'confirm', state: 'AWAITING_CONFIRMATION', cart }))
    expect(out.placeOrder).toBe(false)
    expect(out.nextState).toBe('AWAITING_PAYMENT_METHOD')
  })

  it('cancels on no', () => {
    const out = processMessage(makeInput({ message: 'no', state: 'AWAITING_CONFIRMATION', cart }))
    expect(out.placeOrder).toBe(false)
    expect(out.nextState).toBe('IDLE')
    expect(out.cart).toHaveLength(0)
  })

  it('applies valid discount code', () => {
    const discountCodes = [{ code: 'SAVE10', type: 'percent', value: 10, minAmount: 0, maxUses: 0, usedCount: 0, expiresAt: null }]
    const out = processMessage(makeInput({ message: 'SAVE10', state: 'AWAITING_CONFIRMATION', cart, discountCodes }))
    expect(out.nextState).toBe('AWAITING_CONFIRMATION')
    expect(out.context.appliedCode).toBe('SAVE10')
    expect(out.context.appliedDiscount).toBe(8000) // 10% of 80000
  })

  it('rejects unknown discount code', () => {
    const discountCodes = [{ code: 'SAVE10', type: 'percent', value: 10, minAmount: 0, maxUses: 0, usedCount: 0, expiresAt: null }]
    const out = processMessage(makeInput({ message: 'BADCODE', state: 'AWAITING_CONFIRMATION', cart, discountCodes }))
    expect(out.nextState).toBe('AWAITING_CONFIRMATION')
    expect(out.context.appliedCode).toBeUndefined()
  })
})

describe('FSM AWAITING_MORE (min order + checkout)', () => {
  const cart = [{ menuItemId: 'item-choc', name: 'Chocolate Cake', price: 80000, quantity: 1, fields: [] }]

  it('blocks checkout when below min order', () => {
    const out = processMessage(makeInput({ message: 'confirm', state: 'AWAITING_MORE', cart, minOrderAmount: 100000 }))
    expect(out.nextState).toBe('AWAITING_MORE')
    expect(out.reply).toContain('₹')
  })

  it('proceeds to delivery date when above min order', () => {
    const out = processMessage(makeInput({ message: 'confirm', state: 'AWAITING_MORE', cart, minOrderAmount: 50000 }))
    expect(out.nextState).toBe('AWAITING_DELIVERY_DATE')
  })
})

describe('FSM AWAITING_DELIVERY_DATE', () => {
  const cart = [{ menuItemId: 'item-choc', name: 'Chocolate Cake', price: 80000, quantity: 1, fields: [] }]

  it('accepts delivery date and moves to confirmation', () => {
    const out = processMessage(makeInput({ message: 'Tomorrow 3pm', state: 'AWAITING_DELIVERY_DATE', cart }))
    expect(out.nextState).toBe('AWAITING_CONFIRMATION')
    expect(out.context.deliveryNote).toBe('Tomorrow 3pm')
  })
})

// --- AWAITING_FIELD tests ---

const sizeField: import('@/lib/bot/fsm').RawCategoryField = {
  id: 'field-size',
  categoryId: 'cat-cakes',
  name: 'Size',
  type: 'select',
  required: true,
  placeholder: null,
  sortOrder: 0,
  options: [
    { id: 'opt-500g', label: '500g', priceDelta: 0, sortOrder: 0 },
    { id: 'opt-1kg', label: '1kg', priceDelta: 30000, sortOrder: 1 },
    { id: 'opt-2kg', label: '2kg', priceDelta: 60000, sortOrder: 2 },
  ],
  itemOptions: [],
}

const flavourField: import('@/lib/bot/fsm').RawCategoryField = {
  id: 'field-flavour',
  categoryId: 'cat-cakes',
  name: 'Flavour',
  type: 'select',
  required: true,
  placeholder: null,
  sortOrder: 1,
  options: [
    { id: 'opt-choc', label: 'Chocolate', priceDelta: 0, sortOrder: 0 },
    { id: 'opt-vanilla', label: 'Vanilla', priceDelta: 0, sortOrder: 1 },
  ],
  itemOptions: [],
}

const textField: import('@/lib/bot/fsm').RawCategoryField = {
  id: 'field-note',
  categoryId: 'cat-cakes',
  name: 'Special note',
  type: 'text',
  required: false,
  placeholder: 'Any message on the cake?',
  sortOrder: 2,
  options: [],
  itemOptions: [],
}

const menuItemsWithFields = [
  { id: 'item-choc', name: 'Chocolate Cake', price: 80000, categoryId: 'cat-cakes', description: null, imageUrl: null, productUrl: null },
  { id: 'item-vanilla', name: 'Vanilla Cake', price: 70000, categoryId: 'cat-cakes', description: null, imageUrl: null, productUrl: null },
  { id: 'item-croissant', name: 'Butter Croissant', price: 8000, categoryId: 'cat-pastries', description: null, imageUrl: null, productUrl: null },
]

const fieldMessages = {
  ...defaultMessages,
  field_prompt_footer: 'Reply with a number to select.',
  invalid_field: 'Please choose a valid option.',
}

function makeFieldInput(overrides: Partial<import('@/lib/bot/fsm').BotInput>): import('@/lib/bot/fsm').BotInput {
  return {
    message: '',
    state: 'IDLE',
    cart: [],
    context: {},
    categories,
    menuItems: menuItemsWithFields,
    messages: fieldMessages,
    categoryFields: [sizeField, flavourField],
    ...overrides,
  }
}

describe('AWAITING_ITEM with fields', () => {
  it('transitions to AWAITING_FIELD when category has fields', () => {
    const out = processMessage(makeFieldInput({
      message: '1',
      state: 'AWAITING_ITEM',
      context: { selectedCategoryId: 'cat-cakes' },
      categoryFields: [sizeField],
    }))
    expect(out.nextState).toBe('AWAITING_FIELD')
    expect(out.context.pendingFields).toHaveLength(1)
    expect(out.context.collectedFields).toHaveLength(0)
    expect(out.reply).toContain('Size')
    expect(out.reply).toContain('500g')
    expect(out.reply).toContain('1kg')
  })

  it('skips AWAITING_FIELD and goes to AWAITING_QUANTITY when no fields', () => {
    const out = processMessage(makeFieldInput({
      message: '1',
      state: 'AWAITING_ITEM',
      context: { selectedCategoryId: 'cat-pastries' },
      categoryFields: [sizeField], // sizeField belongs to cat-cakes, not pastries
    }))
    expect(out.nextState).toBe('AWAITING_QUANTITY')
  })
})

describe('AWAITING_FIELD — select field', () => {
  const baseContext = {
    selectedCategoryId: 'cat-cakes',
    selectedItemId: 'item-choc',
    selectedItemName: 'Chocolate Cake',
    selectedItemPrice: 80000,
    pendingFields: [
      { id: 'field-size', name: 'Size', type: 'select' as const, required: true, options: [
        { id: 'opt-500g', label: '500g', priceDelta: 0 },
        { id: 'opt-1kg', label: '1kg', priceDelta: 30000 },
      ]},
      { id: 'field-flavour', name: 'Flavour', type: 'select' as const, required: true, options: [
        { id: 'opt-choc', label: 'Chocolate', priceDelta: 0 },
      ]},
    ],
    collectedFields: [],
  }

  it('accepts number pick for select field, advances to next field', () => {
    const out = processMessage(makeFieldInput({
      message: '2',
      state: 'AWAITING_FIELD',
      context: baseContext,
    }))
    expect(out.nextState).toBe('AWAITING_FIELD')
    expect(out.context.collectedFields).toHaveLength(1)
    expect(out.context.collectedFields![0]).toEqual({ name: 'Size', value: '1kg', priceDelta: 30000 })
    expect(out.reply).toContain('Flavour')
  })

  it('accepts text label for select field', () => {
    const out = processMessage(makeFieldInput({
      message: '500g',
      state: 'AWAITING_FIELD',
      context: baseContext,
    }))
    expect(out.context.collectedFields![0].value).toBe('500g')
    expect(out.context.collectedFields![0].priceDelta).toBe(0)
  })

  it('rejects invalid pick and re-prompts', () => {
    const out = processMessage(makeFieldInput({
      message: '99',
      state: 'AWAITING_FIELD',
      context: baseContext,
    }))
    expect(out.nextState).toBe('AWAITING_FIELD')
    expect(out.context.collectedFields).toHaveLength(0)
  })

  it('transitions to AWAITING_QUANTITY after last field', () => {
    const out = processMessage(makeFieldInput({
      message: '1',
      state: 'AWAITING_FIELD',
      context: {
        ...baseContext,
        collectedFields: [{ name: 'Size', value: '500g', priceDelta: 0 }],
      },
    }))
    expect(out.nextState).toBe('AWAITING_QUANTITY')
    expect(out.context.collectedFields).toHaveLength(2)
  })
})

describe('AWAITING_FIELD — text field', () => {
  const baseCtx = {
    selectedItemId: 'item-choc',
    selectedItemName: 'Chocolate Cake',
    selectedItemPrice: 80000,
    pendingFields: [{ id: 'field-note', name: 'Special note', type: 'text' as const, required: false, placeholder: 'Any message?', options: [] }],
    collectedFields: [],
  }

  it('accepts any non-empty text', () => {
    const out = processMessage(makeFieldInput({ message: 'Happy Birthday!', state: 'AWAITING_FIELD', context: baseCtx }))
    expect(out.nextState).toBe('AWAITING_QUANTITY')
    expect(out.context.collectedFields![0].value).toBe('Happy Birthday!')
  })

  it('accepts skip for non-required field', () => {
    const out = processMessage(makeFieldInput({ message: 'skip', state: 'AWAITING_FIELD', context: baseCtx }))
    expect(out.nextState).toBe('AWAITING_QUANTITY')
    expect(out.context.collectedFields![0].value).toBe('')
  })
})

describe('AWAITING_QUANTITY with fields', () => {
  it('cart item has fields and uses itemTotal for dedup key', () => {
    const context = {
      selectedItemId: 'item-choc',
      selectedItemName: 'Chocolate Cake',
      selectedItemPrice: 80000,
      collectedFields: [{ name: 'Size', value: '1kg', priceDelta: 30000 }],
    }
    const out = processMessage(makeFieldInput({ message: '2', state: 'AWAITING_QUANTITY', context, categoryFields: [] }))
    expect(out.cart).toHaveLength(1)
    expect(out.cart[0].fields).toHaveLength(1)
    expect(out.cart[0].price).toBe(80000)  // base price
    expect(out.cart[0].quantity).toBe(2)
    // total displayed should include field delta: (80000 + 30000) * 2 = 220000 = ₹2200
    expect(out.reply).toContain('2200')
  })
})
