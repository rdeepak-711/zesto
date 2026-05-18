import { describe, it, expect } from 'vitest'

// Pure function extracted from the webhook — we test it in isolation
export function parseBookingCommand(body: string): { cmd: string; shortId: string; extra: string } | null {
  const m = body.trim().match(/^(confirm|reschedule|cancel)\s+([A-Z0-9-]+)(?:\s+(.+))?$/i)
  if (!m) return null
  return { cmd: m[1].toLowerCase(), shortId: m[2].toUpperCase(), extra: (m[3] ?? '').trim() }
}

describe('parseBookingCommand', () => {
  it('parses confirm shortId', () => {
    expect(parseBookingCommand('confirm GZ-001')).toEqual({ cmd: 'confirm', shortId: 'GZ-001', extra: '' })
  })
  it('parses confirm shortId with date/time', () => {
    expect(parseBookingCommand('confirm GZ-001 22may 2pm')).toEqual({ cmd: 'confirm', shortId: 'GZ-001', extra: '22may 2pm' })
  })
  it('parses reschedule', () => {
    expect(parseBookingCommand('reschedule GZ-002 saturday morning')).toEqual({ cmd: 'reschedule', shortId: 'GZ-002', extra: 'saturday morning' })
  })
  it('parses cancel', () => {
    expect(parseBookingCommand('cancel GZ-003')).toEqual({ cmd: 'cancel', shortId: 'GZ-003', extra: '' })
  })
  it('is case-insensitive for command', () => {
    expect(parseBookingCommand('CONFIRM gz-001')?.cmd).toBe('confirm')
    expect(parseBookingCommand('CONFIRM gz-001')?.shortId).toBe('GZ-001')
  })
  it('returns null for non-commands', () => {
    expect(parseBookingCommand('orders')).toBeNull()
    expect(parseBookingCommand('hello GZ-001')).toBeNull()
    expect(parseBookingCommand('')).toBeNull()
  })
})
