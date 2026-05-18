import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('image-size', () => ({
  imageSize: vi.fn(),
}))
import { imageSize } from 'image-size'
import { detectProduct, handleEnquiryState, type EnquiryHandlerParams } from '@/lib/bot/enquiry'

const BASE_PARAMS: EnquiryHandlerParams = {
  tenantId: 'tenant-1',
  customerPhone: '+919000000001',
  ownerPhone: '+919000000099',
  whatsappNumber: '+919000000002',
  body: '',
  mediaUrl: undefined,
  numMedia: 0,
  state: 'IDLE',
  context: {},
  messages: { enquiry_keywords: 'frame,photo frame' },
  twilioAccountSid: 'ACtest',
  twilioAuthToken: 'authtest',
}

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

describe('AC_AWAITING_SPEC — photo-only message', () => {
  it('stores "(photo reference)" as spec when body is empty and media is attached', async () => {
    const result = await handleEnquiryState({
      ...BASE_PARAMS,
      state: 'AC_AWAITING_SPEC',
      body: '',
      numMedia: 1,
      mediaUrl: 'https://media.example.com/ref.jpg',
      context: {
        enquiryProduct: 'Acrylic — Acrylic wall clock',
        enquiryAnswers: { acrylicType: 'Acrylic wall clock' },
      },
    })
    expect(result?.nextContext.enquiryAnswers?.spec).toBe('(photo reference)')
  })

  it('stores the typed text as spec when customer types a spec', async () => {
    const result = await handleEnquiryState({
      ...BASE_PARAMS,
      state: 'AC_AWAITING_SPEC',
      body: '12 inches diameter',
      numMedia: 0,
      context: {
        enquiryProduct: 'Acrylic — Acrylic wall clock',
        enquiryAnswers: { acrylicType: 'Acrylic wall clock' },
      },
    })
    expect(result?.nextContext.enquiryAnswers?.spec).toBe('12 inches diameter')
  })
})

describe('mid-flow reset keywords', () => {
  it('"menu" mid-frame-flow resets to ENQUIRY_LISTENING', async () => {
    const result = await handleEnquiryState({
      ...BASE_PARAMS,
      state: 'PF_AWAITING_SIZE',
      body: 'menu',
      context: {
        enquiryProduct: 'Photo Frame',
        enquiryAnswers: { frameType: 'MDF frames (table / wall / shadow)' },
      },
    })
    expect(result?.nextState).toBe('ENQUIRY_LISTENING')
    expect(result?.nextContext).toEqual({})
    expect(result?.done).toBe(false)
  })

  it('"start over" mid-acrylic-flow resets to ENQUIRY_LISTENING', async () => {
    const result = await handleEnquiryState({
      ...BASE_PARAMS,
      state: 'AC_AWAITING_SPEC',
      body: 'start over',
      context: {
        enquiryProduct: 'Acrylic — Acrylic wall clock',
        enquiryAnswers: { acrylicType: 'Acrylic wall clock' },
      },
    })
    expect(result?.nextState).toBe('ENQUIRY_LISTENING')
    expect(result?.nextContext).toEqual({})
  })

  it('"menu" at IDLE is not treated as reset — falls through to OTHER_AWAITING_DETAILS', async () => {
    const result = await handleEnquiryState({
      ...BASE_PARAMS,
      state: 'IDLE',
      body: 'menu',
    })
    expect(result?.nextState).toBe('OTHER_AWAITING_DETAILS')
  })
})

describe('PF_AWAITING_PHOTO — photo suggestion constraints', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('does NOT call fetch when size is "Custom size"', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await handleEnquiryState({
      ...BASE_PARAMS,
      state: 'PF_AWAITING_PHOTO',
      body: '',
      numMedia: 1,
      mediaUrl: 'https://media.example.com/photo.jpg',
      context: {
        enquiryProduct: 'Photo Frame',
        enquiryAnswers: { frameType: 'MDF frames', size: 'Custom size' },
      },
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result?.nextContext.enquiryAnswers?.suggestedSize).toBeUndefined()
  })

  it('suggestion is a size present in the numbered menu (not an off-menu size like 8×8)', async () => {
    vi.mocked(imageSize).mockReturnValue({ width: 800, height: 800 })
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    } as unknown as Response)

    const result = await handleEnquiryState({
      ...BASE_PARAMS,
      state: 'PF_AWAITING_PHOTO',
      body: '',
      numMedia: 1,
      mediaUrl: 'https://media.example.com/photo.jpg',
      context: {
        enquiryProduct: 'Photo Frame',
        enquiryAnswers: { frameType: 'MDF frames', size: '8×10' },
      },
    })

    const suggested = result?.nextContext.enquiryAnswers?.suggestedSize
    if (suggested) {
      const MENU_SIZE_LABELS = [
        '4×6 inches','5×7 inches','6×8 inches','8×10 inches','10×12 inches',
        '12×15 inches','12×18 inches','16×20 inches','20×24 inches','20×30 inches',
      ]
      expect(MENU_SIZE_LABELS).toContain(suggested)
      expect(suggested).not.toBe('8×8 inches')
    }
  })
})
