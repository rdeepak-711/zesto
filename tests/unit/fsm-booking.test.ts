import { describe, it, expect } from 'vitest'
import { processMessage, type BotInput } from '@/lib/bot/fsm'

const categories = [
  { id: 'cat-hair', name: 'Hair Services', sortOrder: 1, isCustom: false },
  { id: 'cat-skin', name: 'Skin Services', sortOrder: 2, isCustom: false },
]
const menuItems = [
  { id: 'item-spa', name: 'Hair Spa', price: 69900, categoryId: 'cat-hair' },
  { id: 'item-facial', name: 'Facial', price: 39900, categoryId: 'cat-skin' },
]
const defaultMessages = {
  welcome: 'Welcome! {categories}',
  menu_header: 'Our Menu\n\n{categories}',
  invalid_category: 'Choose a category:\n\n{categories}',
  items_footer: 'Reply with a number.',
  invalid_item: 'Please choose a valid item.',
  quantity_prompt: 'How many *{item}*?',
  invalid_quantity: 'Please enter a valid quantity (1–99).',
  item_added: '✅ Added {qty}× *{item}*.',
  add_more_prompt: 'Add more?\n\n{categories}\n\nOr type *confirm*.',
  choose_more: 'Choose a category:\n\n{categories}\n\nOr type *confirm*.',
  order_summary: '🧾 Summary\n\n{cart}',
  order_placed: '🎉 Order placed!',
  order_pending: 'Order being reviewed.',
  cancel: 'Cancelled.',
  cart_empty: 'Your cart is empty.',
  confirm_hint: 'Type *confirm*.',
  await_confirm: 'Reply *yes* to confirm.',
  back_to_categories: 'Choose a category:\n\n{categories}',
  delivery_date_prompt: '📅 When?',
  booking_ask_name: 'What is your name?',
  booking_ask_age: 'How old are you? 🌸',
  booking_ask_date: 'What date would you prefer?',
  booking_ask_time: 'What time works best?\n1. Morning\n2. Afternoon\n3. Evening',
  booking_confirm_prompt: 'Shall we book this? Reply *yes* to confirm.',
  booking_pending: "Got it! 🎉 We'll confirm your exact time very soon!",
}

function base(overrides: Partial<BotInput>): BotInput {
  return {
    message: '', state: 'IDLE', cart: [], context: {},
    categories, menuItems, messages: defaultMessages,
    hasBooking: true,
    ...overrides,
  }
}

const cart = [{ menuItemId: 'item-spa', name: 'Hair Spa', price: 69900, quantity: 1, fields: [] }]

describe('FSM booking flow', () => {
  it('AWAITING_MORE confirm → AWAITING_NAME when hasBooking=true', () => {
    const out = processMessage(base({ message: 'confirm', state: 'AWAITING_MORE', cart }))
    expect(out.nextState).toBe('AWAITING_NAME')
    expect(out.reply).toContain('name')
  })

  it('AWAITING_MORE confirm → AWAITING_DELIVERY_DATE when hasBooking=false', () => {
    const out = processMessage(base({ message: 'confirm', state: 'AWAITING_MORE', cart, hasBooking: false }))
    expect(out.nextState).toBe('AWAITING_DELIVERY_DATE')
  })

  it('AWAITING_NAME short input → stays AWAITING_NAME', () => {
    const out = processMessage(base({ message: 'A', state: 'AWAITING_NAME', cart }))
    expect(out.nextState).toBe('AWAITING_NAME')
  })

  it('AWAITING_NAME valid → AWAITING_AGE, stores name in context', () => {
    const out = processMessage(base({ message: 'Priya', state: 'AWAITING_NAME', cart }))
    expect(out.nextState).toBe('AWAITING_AGE')
    expect(out.context.customerName).toBe('Priya')
  })

  it('AWAITING_AGE invalid → stays AWAITING_AGE', () => {
    const out = processMessage(base({ message: 'abc', state: 'AWAITING_AGE', cart, context: { customerName: 'Priya' } }))
    expect(out.nextState).toBe('AWAITING_AGE')
  })

  it('AWAITING_AGE valid → AWAITING_BOOKING_DATE, stores age', () => {
    const out = processMessage(base({ message: '24', state: 'AWAITING_AGE', cart, context: { customerName: 'Priya' } }))
    expect(out.nextState).toBe('AWAITING_BOOKING_DATE')
    expect(out.context.customerAge).toBe(24)
  })

  it('AWAITING_AGE age 0 → stays AWAITING_AGE', () => {
    const out = processMessage(base({ message: '0', state: 'AWAITING_AGE', cart, context: { customerName: 'Priya' } }))
    expect(out.nextState).toBe('AWAITING_AGE')
  })

  it('AWAITING_AGE age 150 → stays AWAITING_AGE', () => {
    const out = processMessage(base({ message: '150', state: 'AWAITING_AGE', cart, context: { customerName: 'Priya' } }))
    expect(out.nextState).toBe('AWAITING_AGE')
  })

  it('AWAITING_BOOKING_DATE too short → stays', () => {
    const out = processMessage(base({ message: 'S', state: 'AWAITING_BOOKING_DATE', cart, context: { customerName: 'Priya', customerAge: 24 } }))
    expect(out.nextState).toBe('AWAITING_BOOKING_DATE')
  })

  it('AWAITING_BOOKING_DATE valid → AWAITING_BOOKING_TIME, stores date', () => {
    const out = processMessage(base({ message: 'this saturday', state: 'AWAITING_BOOKING_DATE', cart, context: { customerName: 'Priya', customerAge: 24 } }))
    expect(out.nextState).toBe('AWAITING_BOOKING_TIME')
    expect(out.context.bookingDate).toBe('this saturday')
  })

  it('AWAITING_BOOKING_TIME invalid → stays', () => {
    const out = processMessage(base({ message: 'maybe', state: 'AWAITING_BOOKING_TIME', cart, context: { customerName: 'Priya', customerAge: 24, bookingDate: 'saturday' } }))
    expect(out.nextState).toBe('AWAITING_BOOKING_TIME')
  })

  it('AWAITING_BOOKING_TIME "1" → AWAITING_CONFIRMATION, stores "morning"', () => {
    const out = processMessage(base({ message: '1', state: 'AWAITING_BOOKING_TIME', cart, context: { customerName: 'Priya', customerAge: 24, bookingDate: 'saturday' } }))
    expect(out.nextState).toBe('AWAITING_CONFIRMATION')
    expect(out.context.bookingTime).toBe('morning')
    expect(out.reply).toContain('saturday')
    expect(out.reply).toContain('Priya')
  })

  it('AWAITING_BOOKING_TIME "afternoon" → AWAITING_CONFIRMATION', () => {
    const out = processMessage(base({ message: 'afternoon', state: 'AWAITING_BOOKING_TIME', cart, context: { customerName: 'Priya', customerAge: 24, bookingDate: 'saturday' } }))
    expect(out.nextState).toBe('AWAITING_CONFIRMATION')
    expect(out.context.bookingTime).toBe('afternoon')
  })

  it('AWAITING_BOOKING_TIME "2" → AWAITING_CONFIRMATION, stores "afternoon"', () => {
    const out = processMessage(base({ message: '2', state: 'AWAITING_BOOKING_TIME', cart, context: { customerName: 'Priya', customerAge: 24, bookingDate: 'saturday' } }))
    expect(out.nextState).toBe('AWAITING_CONFIRMATION')
    expect(out.context.bookingTime).toBe('afternoon')
  })

  it('AWAITING_BOOKING_TIME "3" → AWAITING_CONFIRMATION, stores "evening"', () => {
    const out = processMessage(base({ message: '3', state: 'AWAITING_BOOKING_TIME', cart, context: { customerName: 'Priya', customerAge: 24, bookingDate: 'saturday' } }))
    expect(out.nextState).toBe('AWAITING_CONFIRMATION')
    expect(out.context.bookingTime).toBe('evening')
  })

  it('AWAITING_BOOKING_TIME "evening" → AWAITING_CONFIRMATION', () => {
    const out = processMessage(base({ message: 'evening', state: 'AWAITING_BOOKING_TIME', cart, context: { customerName: 'Priya', customerAge: 24, bookingDate: 'saturday' } }))
    expect(out.nextState).toBe('AWAITING_CONFIRMATION')
    expect(out.context.bookingTime).toBe('evening')
  })

  it('AWAITING_CONFIRMATION yes + hasBooking → PENDING_BOOKING + placeOrder=true', () => {
    const ctx = { customerName: 'Priya', customerAge: 24, bookingDate: 'saturday', bookingTime: 'morning' }
    const out = processMessage(base({ message: 'yes', state: 'AWAITING_CONFIRMATION', cart, context: ctx }))
    expect(out.nextState).toBe('PENDING_BOOKING')
    expect(out.placeOrder).toBe(true)
  })

  it('PENDING_BOOKING any message → stays PENDING_BOOKING with reply', () => {
    const out = processMessage(base({ message: 'hello', state: 'PENDING_BOOKING', cart: [] }))
    expect(out.nextState).toBe('PENDING_BOOKING')
    expect(out.placeOrder).toBe(false)
    expect(out.reply.length).toBeGreaterThan(0)
  })
})
