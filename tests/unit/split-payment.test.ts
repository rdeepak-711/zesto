import { describe, it, expect } from 'vitest'

function advanceAmount(totalPaise: number): number {
  return Math.round(totalPaise / 2)
}

describe('split payment advance calculation', () => {
  it('halves even amounts correctly', () => {
    expect(advanceAmount(150000)).toBe(75000)  // ₹1500 → ₹750
  })

  it('rounds half-paise correctly', () => {
    expect(advanceAmount(100001)).toBe(50001)  // rounds up
    expect(advanceAmount(100003)).toBe(50002)  // rounds correctly
  })

  it('handles zero', () => {
    expect(advanceAmount(0)).toBe(0)
  })
})
