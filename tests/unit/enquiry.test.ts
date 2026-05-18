import { describe, it, expect } from 'vitest'
import { detectProduct } from '@/lib/bot/enquiry'

const PF_KEYWORDS = 'frame,photo frame'

describe('detectProduct — acrylic subtype routing', () => {
  it('routes "standee" to acrylic', () => {
    expect(detectProduct('I want a standee please', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes "wall clock" to acrylic', () => {
    expect(detectProduct('wall clock for living room', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes "clock" alone to acrylic', () => {
    expect(detectProduct('need a clock', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes "trophy" to acrylic', () => {
    expect(detectProduct('want a trophy for my team', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes "lamp" to acrylic', () => {
    expect(detectProduct('bed lamp please', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes bare "lamp" to acrylic', () => {
    expect(detectProduct('I want a lamp', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes "cake topper" to acrylic', () => {
    expect(detectProduct('cake topper for wedding', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes "light box" to acrylic', () => {
    expect(detectProduct('light box for shop', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes "illusion" to acrylic', () => {
    expect(detectProduct('illusion gods frame', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes "acrylic" to acrylic', () => {
    expect(detectProduct('want acrylic product', PF_KEYWORDS)).toBe('acrylic')
  })
  it('routes "frame" to photo_frame', () => {
    expect(detectProduct('photo frame for my daughter', PF_KEYWORDS)).toBe('photo_frame')
  })
  it('routes unknown text to other', () => {
    expect(detectProduct('hello I need something nice', PF_KEYWORDS)).toBe('other')
  })
  it('photo_frame takes priority when keyword appears first', () => {
    expect(detectProduct('frame with acrylic glass', PF_KEYWORDS)).toBe('photo_frame')
  })
})
