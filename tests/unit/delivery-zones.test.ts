import { describe, it, expect } from 'vitest'
import { processMessage } from '../../src/lib/bot/fsm'
import type { BotInput } from '../../src/lib/bot/fsm'

const base: Omit<BotInput, 'message' | 'state'> = {
  cart: [{ menuItemId: 'item-001', name: 'Chocolate Cake', price: 75000, quantity: 1, fields: [] }],
  context: {},
  categories: [],
  menuItems: [],
  messages: {},
}

describe('delivery zones prompt', () => {
  it('includes zones in prompt when configured', () => {
    const result = processMessage({
      ...base,
      message: 'hi',
      state: 'AWAITING_DELIVERY_DATE',
      deliveryZones: 'T.Nagar, Adyar, Velachery',
    })
    expect(result.reply).toContain('T.Nagar')
    expect(result.reply).toContain('Adyar')
    expect(result.nextState).toBe('AWAITING_DELIVERY_DATE')
  })

  it('does not include zones line when not configured', () => {
    const result = processMessage({
      ...base,
      message: 'hi',
      state: 'AWAITING_DELIVERY_DATE',
    })
    expect(result.reply).not.toContain('We deliver to')
    expect(result.nextState).toBe('AWAITING_DELIVERY_DATE')
  })

  it('short message re-prompts', () => {
    const result = processMessage({
      ...base,
      message: 'x',
      state: 'AWAITING_DELIVERY_DATE',
      deliveryZones: 'T.Nagar',
    })
    expect(result.nextState).toBe('AWAITING_DELIVERY_DATE')
  })

  it('valid date input advances to AWAITING_CONFIRMATION', () => {
    const result = processMessage({
      ...base,
      message: 'Friday 3pm, T.Nagar',
      state: 'AWAITING_DELIVERY_DATE',
      deliveryZones: 'T.Nagar, Adyar',
    })
    expect(result.nextState).toBe('AWAITING_CONFIRMATION')
    expect(result.context.deliveryNote).toBe('Friday 3pm, T.Nagar')
  })
})
