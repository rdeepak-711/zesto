import { describe, it, expect } from 'vitest'
import { isSessionStale } from '@/lib/botSession'

describe('isSessionStale', () => {
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

  it('returns false when state is IDLE regardless of age', () => {
    const old = new Date(Date.now() - FOUR_HOURS_MS - 1000)
    expect(isSessionStale('IDLE', old)).toBe(false)
  })

  it('returns false when state is ORDER_PENDING regardless of age', () => {
    const old = new Date(Date.now() - FOUR_HOURS_MS - 1000)
    expect(isSessionStale('ORDER_PENDING', old)).toBe(false)
  })

  it('returns false when session is fresh (< 4h) even in mid-flow state', () => {
    const fresh = new Date(Date.now() - 30 * 60 * 1000) // 30 min ago
    expect(isSessionStale('AWAITING_QUANTITY', fresh)).toBe(false)
  })

  it('returns true when session is > 4h old and in mid-flow state', () => {
    const old = new Date(Date.now() - FOUR_HOURS_MS - 1000)
    expect(isSessionStale('AWAITING_QUANTITY', old)).toBe(true)
  })

  it('returns true for AWAITING_CATEGORY if > 4h old', () => {
    const old = new Date(Date.now() - FOUR_HOURS_MS - 1000)
    expect(isSessionStale('AWAITING_CATEGORY', old)).toBe(true)
  })

  it('returns false for AWAITING_CATEGORY if exactly 4h (not exceeded)', () => {
    const exact = new Date(Date.now() - FOUR_HOURS_MS)
    expect(isSessionStale('AWAITING_CATEGORY', exact)).toBe(false)
  })
})
