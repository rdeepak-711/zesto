import { describe, it, expect } from 'vitest'
import { processMessage } from '../../src/lib/bot/fsm'
import type { BotInput } from '../../src/lib/bot/fsm'

const base: Omit<BotInput, 'message' | 'state'> = {
  cart: [],
  context: {},
  categories: [{ id: 'cat-custom-001', name: 'Custom Cake', sortOrder: 4, isCustom: true }],
  menuItems: [{ id: 'item-custom-001', name: 'Custom Cake', price: 0, categoryId: 'cat-custom-001' }],
  messages: {},
}

describe('custom order structured brief', () => {
  it('selecting custom category enters AWAITING_CUSTOM_OCCASION', () => {
    const result = processMessage({ ...base, message: '1', state: 'AWAITING_CATEGORY' })
    expect(result.nextState).toBe('AWAITING_CUSTOM_OCCASION')
    expect(result.reply).toContain('occasion')
  })

  it('AWAITING_CUSTOM_OCCASION: numbered choice stores occasion and advances', () => {
    const result = processMessage({ ...base, message: '1', state: 'AWAITING_CUSTOM_OCCASION' })
    expect(result.nextState).toBe('AWAITING_CUSTOM_DATE')
    expect(result.context.customOccasion).toBe('Birthday')
  })

  it('AWAITING_CUSTOM_OCCASION: free text stores occasion and advances', () => {
    const result = processMessage({ ...base, message: 'Baby shower', state: 'AWAITING_CUSTOM_OCCASION' })
    expect(result.nextState).toBe('AWAITING_CUSTOM_DATE')
    expect(result.context.customOccasion).toBe('Baby shower')
  })

  it('AWAITING_CUSTOM_DATE: any text with 2+ chars advances', () => {
    const result = processMessage({ ...base, message: 'this Saturday', state: 'AWAITING_CUSTOM_DATE' })
    expect(result.nextState).toBe('AWAITING_CUSTOM_SERVINGS')
    expect(result.context.customDate).toBe('this Saturday')
  })

  it('AWAITING_CUSTOM_SERVINGS: any text advances', () => {
    const result = processMessage({ ...base, message: '20 people', state: 'AWAITING_CUSTOM_SERVINGS' })
    expect(result.nextState).toBe('AWAITING_CUSTOM_DIETARY')
    expect(result.context.customServings).toBe('20 people')
  })

  it('AWAITING_CUSTOM_DIETARY: numbered choice stores dietary', () => {
    const result = processMessage({ ...base, message: '1', state: 'AWAITING_CUSTOM_DIETARY' })
    expect(result.nextState).toBe('AWAITING_CUSTOM_BUDGET')
    expect(result.context.customDietary).toBe('Eggless')
  })

  it('AWAITING_CUSTOM_BUDGET: numbered choice stores budget and goes to description', () => {
    const result = processMessage({ ...base, message: '3', state: 'AWAITING_CUSTOM_BUDGET' })
    expect(result.nextState).toBe('AWAITING_CUSTOM_DESCRIPTION')
    expect(result.context.customBudget).toBe('₹2,000–5,000')
  })

  it('AWAITING_CUSTOM_DESCRIPTION: skip advances to confirm with brief summary', () => {
    const result = processMessage({
      ...base,
      message: 'skip',
      state: 'AWAITING_CUSTOM_DESCRIPTION',
      context: { customOccasion: 'Birthday', customDate: 'Saturday', customServings: '20', customDietary: 'Eggless', customBudget: '₹2,000–5,000' },
    })
    expect(result.nextState).toBe('AWAITING_CUSTOM_CONFIRM')
    expect(result.reply).toContain('Birthday')
    expect(result.reply).toContain('Saturday')
  })

  it('AWAITING_CUSTOM_CONFIRM: yes places order', () => {
    const result = processMessage({
      ...base,
      message: 'yes',
      state: 'AWAITING_CUSTOM_CONFIRM',
      context: { customOccasion: 'Birthday', customDate: 'Saturday', customServings: '20', customDietary: 'Eggless', customBudget: '₹2,000–5,000' },
    })
    expect(result.placeOrder).toBe(true)
    expect(result.nextState).toBe('ORDER_PENDING')
  })
})
