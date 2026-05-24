/**
 * Enquiry handler for Phoenix Photo Studio.
 *
 * Flow: customer's first message is keyword-routed to a numbered menu.
 * - Photo Frames: type (6 groups) → size → occasion → quantity → optional photo → name
 * - Acrylic: type (10 products) → spec → occasion → quantity → optional photo → name
 * - Unrecognised: single free-text capture → owner alert
 */

import { db } from '@/lib/db'
import { type BotContext } from '@/lib/botSession'
import { sendWhatsApp } from '@/lib/twilio'
import { imageSize } from 'image-size'

// ── Frame size table ──────────────────────────────────────────────────────────

const FRAME_SIZES = [
  { name: '4×6',  label: '4×6 inches',  price: 200,  w: 4,  h: 6  },
  { name: '5×7',  label: '5×7 inches',  price: 270,  w: 5,  h: 7  },
  { name: '6×8',  label: '6×8 inches',  price: 300,  w: 6,  h: 8  },
  { name: '8×8',  label: '8×8 inches',  price: 350,  w: 8,  h: 8  },
  { name: '5×10', label: '5×10 inches', price: 400,  w: 5,  h: 10 },
  { name: '8×10', label: '8×10 inches', price: 400,  w: 8,  h: 10 },
  { name: '10×12',label: '10×12 inches',price: 550,  w: 10, h: 12 },
  { name: '12×8', label: '12×8 inches', price: 450,  w: 12, h: 8  },
  { name: '12×15',label: '12×15 inches',price: 750,  w: 12, h: 15 },
  { name: '12×18',label: '12×18 inches',price: 900,  w: 12, h: 18 },
  { name: '15×10',label: '15×10 inches',price: 650,  w: 15, h: 10 },
  { name: '12×20',label: '12×20 inches',price: 1100, w: 12, h: 20 },
  { name: '16×20',label: '16×20 inches',price: 1300, w: 16, h: 20 },
  { name: '16×24',label: '16×24 inches',price: 1800, w: 16, h: 24 },
  { name: '20×24',label: '20×24 inches',price: 2000, w: 20, h: 24 },
  { name: '20×30',label: '20×30 inches',price: 2500, w: 20, h: 30 },
]

// ── Frame type groups ─────────────────────────────────────────────────────────

const FRAME_GROUPS = [
  { num: 1, label: 'Standard / Embossing / Alloy frames' },
  { num: 2, label: 'MDF frames (table / wall / shadow)' },
  { num: 3, label: 'Canvas / LED / Backlight frames' },
  { num: 4, label: 'Baby / Collage / Multi-heart frames' },
  { num: 5, label: 'Sublimation / Crystal / Metal print' },
  { num: 6, label: 'Twin / Miniature frames' },
]

const SIZE_OPTIONS = ['4×6','5×7','6×8','8×10','10×12','12×15','12×18','16×20','20×24','20×30']

// Sizes eligible for photo-based suggestions — must match the numbered menu exactly
const MENU_SIZES = FRAME_SIZES.filter(s => SIZE_OPTIONS.includes(s.name))

const FRAME_GROUP_MENU =
  'Which type of frame are you interested in?\n\n' +
  FRAME_GROUPS.map(g => `${g.num}. ${g.label}`).join('\n') +
  '\n\nReply with a number.'

// ── Acrylic product types ─────────────────────────────────────────────────────

const ACRYLIC_TYPES = [
  { num: 1,  label: 'Life-size standee (cutout)',                   specPrompt: 'What height? (e.g. 3ft, 5ft, or custom)' },
  { num: 2,  label: 'Acrylic photo frame',                          specPrompt: 'What size? (e.g. 5×7, 8×10, or custom)' },
  { num: 3,  label: 'Acrylic wall clock',                           specPrompt: 'What diameter? (e.g. 10 inches, 12 inches)' },
  { num: 4,  label: 'Acrylic bed lamp / table top',                 specPrompt: 'What size or shape are you thinking?' },
  { num: 5,  label: 'Acrylic light box',                            specPrompt: 'What size do you need?' },
  { num: 6,  label: 'Acrylic flat print (4mm)',                     specPrompt: 'What size? (e.g. 8×10, 12×15)' },
  { num: 7,  label: 'Acrylic lamp gift (engraving / colour print)', specPrompt: 'Any specific design or text in mind?' },
  { num: 8,  label: 'Acrylic illusion gods',                        specPrompt: 'Which deity or design do you have in mind?' },
  { num: 9,  label: 'Acrylic trophy / award',                       specPrompt: 'What text or design should appear on it?' },
  { num: 10, label: 'Semi rec / cake topper',                       specPrompt: "Any names or text you'd like on it?" },
]

const ACRYLIC_TYPE_MENU =
  'Which acrylic product are you looking for?\n\n' +
  ACRYLIC_TYPES.map(t => `${t.num}. ${t.label}`).join('\n') +
  '\n\nReply with a number.'

const OCCASIONS = ['1. Gift 🎁', '2. Home decor 🏠', '3. Personal memory 📷', '4. Event / Function 🎉', '5. Other']
const OCCASION_MENU = "What's the occasion?\n\n" + OCCASIONS.join('\n') + '\n\nReply with a number.'
const OCCASION_LABELS = ['Gift', 'Home decor', 'Personal memory', 'Event / Function', 'Other']

// ── Intent detection ──────────────────────────────────────────────────────────

const GREETING_PATTERNS = /^(hi+|hello|hey|hii+|hai|good\s*(morning|evening|afternoon|night)|namaste|sup|yo|howdy)\W*$/i

function isGreeting(text: string): boolean {
  return GREETING_PATTERNS.test(text.trim())
}

// ── Acrylic keyword set (covers all product subtypes by common name) ──────────
// High-priority subtypes: specific product names that override photo_frame keywords.
const ACRYLIC_SUBTYPE_KEYWORDS = [
  'standee', 'cutout', 'wall clock', 'clock', 'bed lamp', 'lamp',
  'table top', 'tabletop', 'light box', 'lightbox', 'flat print',
  'lamp gift', 'engraving', 'illusion', 'trophy', 'award',
  'cake topper', 'semi rec',
]
// Low-priority: generic category word; loses to photo_frame keywords.
const ACRYLIC_GENERIC_KEYWORDS = ['acrylic']

export function detectProduct(text: string, enquiryKeywords: string): 'photo_frame' | 'acrylic' | 'other' {
  const m = text.toLowerCase()
  const pfKeywords = enquiryKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
  // Specific acrylic subtype names win over photo_frame keywords.
  if (ACRYLIC_SUBTYPE_KEYWORDS.some(kw => m.includes(kw))) return 'acrylic'
  if (pfKeywords.some(kw => m.includes(kw))) return 'photo_frame'
  if (ACRYLIC_GENERIC_KEYWORDS.some(kw => m.includes(kw))) return 'acrylic'
  return 'other'
}

/** Try to extract a frame size from free text. Returns matched size or null. */
function extractFrameSize(text: string): typeof FRAME_SIZES[0] | null {
  const m = text.toLowerCase().replace(/\s/g, '').replace(/"/g, '').replace(/inch(es)?/g, '')
  for (const s of FRAME_SIZES) {
    const variants = [
      s.name.toLowerCase().replace(/×/g, 'x'),
      s.name.toLowerCase().replace(/×/g, '×'),
      s.name.toLowerCase().replace(/×/g, ' x ').replace(/\s/g, ''),
      `${s.w}x${s.h}`, `${s.h}x${s.w}`,
    ]
    if (variants.some(v => m.includes(v.replace(/\s/g, '')))) return s
  }
  return null
}

/** Best-fit frame by photo aspect ratio. Returns null if selected size is already fine (within 15%). */
async function suggestFrameFromPhoto(
  mediaUrl: string,
  accountSid: string,
  authToken: string,
  selectedSize?: typeof FRAME_SIZES[0],
): Promise<{ bestFit: typeof FRAME_SIZES[0]; isNew: boolean } | null> {
  try {
    const res = await fetch(mediaUrl, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64') },
    })
    if (!res.ok) return null
    const { width, height } = imageSize(Buffer.from(await res.arrayBuffer()))
    if (!width || !height) return null

    const photoRatio = width / height
    const best = MENU_SIZES.reduce((prev, cur) => {
      const cDiff = Math.abs(photoRatio - cur.w / cur.h)
      const pDiff = Math.abs(photoRatio - prev.w / prev.h)
      return cDiff < pDiff ? cur : prev
    })

    if (selectedSize) {
      const selectedRatio = selectedSize.w / selectedSize.h
      const diff = Math.abs(photoRatio - selectedRatio) / selectedRatio
      if (diff <= 0.15) return null // close enough
      return { bestFit: best, isNew: best.name !== selectedSize.name }
    }
    return { bestFit: best, isNew: true }
  } catch {
    return null
  }
}

// ── Summary builder ───────────────────────────────────────────────────────────

function buildSummary(product: string, answers: Record<string, string>): string {
  const lines: string[] = [`Product: ${product}`]
  if (answers.frameType)     lines.push(`Frame type: ${answers.frameType}`)
  if (answers.acrylicType)   lines.push(`Acrylic type: ${answers.acrylicType}`)
  if (answers.size)          lines.push(`Size: ${answers.size}`)
  if (answers.spec)          lines.push(`Spec: ${answers.spec}`)
  if (answers.occasion)      lines.push(`Occasion: ${answers.occasion}`)
  if (answers.quantity)      lines.push(`Quantity: ${answers.quantity}`)
  if (answers.details)       lines.push(`Details: ${answers.details}`)
  if (answers.photoUrl)      lines.push(`Photo: ${answers.photoUrl}`)
  if (answers.suggestedSize) lines.push(`⚠️ Photo fits better in: ${answers.suggestedSize}`)
  if (answers.name)          lines.push(`Customer name: ${answers.name}`)
  return lines.join('\n')
}

/** Save custom order with summary notes and notify owner. */
async function saveEnquiryAndNotify(params: {
  tenantId: string
  customerPhone: string
  ownerPhone: string
  whatsappNumber: string
  product: string
  answers: Record<string, string>
}) {
  const { tenantId, customerPhone, ownerPhone, whatsappNumber, product, answers } = params
  const notes = buildSummary(product, answers)

  const customCat = await db.menuCategory.findFirst({ where: { tenantId, isCustom: true } })
  const customItem = customCat
    ? await db.menuItem.findFirst({ where: { tenantId, categoryId: customCat.id } })
    : null
  if (!customItem) {
    const notes = buildSummary(product, answers)
    const ownerMsg =
      `📩 *New Enquiry*\n📱 ${customerPhone}\n\n` +
      notes +
      `\n\nReply to confirm details & pricing.`
    await sendWhatsApp(ownerPhone, ownerMsg, whatsappNumber)
    return
  }

  const prev = await db.order.findFirst({
    where: { tenantId, customerPhone },
    orderBy: { createdAt: 'desc' },
    select: { customerName: true },
  })

  const order = await db.order.create({
    data: {
      tenantId,
      customerPhone,
      customerName: answers.name || prev?.customerName || 'WhatsApp Enquiry',
      totalAmount: 0,
      notes,
      paymentMethod: 'ONLINE',
      items: {
        create: [{
          menuItemId: customItem.id,
          name: product,
          price: 0,
          quantity: parseInt(answers.quantity ?? '1', 10) || 1,
          fieldsJson: '[]',
        }],
      },
    },
  })

  const shortId = order.id.slice(0, 8).toUpperCase()
  const ownerMsg =
    `📩 *New Enquiry #${shortId}*\n📱 ${customerPhone}\n\n` +
    notes +
    `\n\nReply to confirm details & pricing.`

  await sendWhatsApp(ownerPhone, ownerMsg, whatsappNumber)
}

// ── Context type ──────────────────────────────────────────────────────────────

export type EnquiryContext = BotContext & {
  enquiryProduct?: string
  enquiryAnswers?: Record<string, string>
}

export type EnquiryHandlerParams = {
  tenantId: string
  customerPhone: string
  ownerPhone: string
  whatsappNumber: string
  body: string
  mediaUrl?: string
  numMedia: number
  state: string
  context: EnquiryContext
  messages: Record<string, string>
  twilioAccountSid: string
  twilioAuthToken: string
}

type EnquiryResult = {
  reply: string
  nextState: string
  nextContext: EnquiryContext
  done: boolean
}

// ── All enquiry states the webhook should intercept ───────────────────────────
export const ENQUIRY_STATES = [
  'AWAITING_CATEGORY',
  'ENQUIRY_LISTENING',
  // Photo Frame flow
  'PF_AWAITING_TYPE',
  'PF_AWAITING_SIZE',
  'PF_AWAITING_OCCASION',
  'PF_AWAITING_QUANTITY',
  'PF_AWAITING_PHOTO',
  'PF_AWAITING_NAME',
  // Acrylic flow
  'AC_AWAITING_TYPE',
  'AC_AWAITING_SPEC',
  'AC_AWAITING_OCCASION',
  'AC_AWAITING_QUANTITY',
  'AC_AWAITING_PHOTO',
  'AC_AWAITING_NAME',
  // Unrecognised flow
  'OTHER_AWAITING_DETAILS',
]

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleEnquiryState(p: EnquiryHandlerParams): Promise<EnquiryResult | null> {
  const { body, state, context } = p
  const m = body.trim()
  const keywords = p.messages['enquiry_keywords'] ?? 'frame,photo frame,acrylic'

  // ── Global reset keywords (only active mid-flow: PF_*, AC_*, OTHER_AWAITING_DETAILS) ────────────
  const midFlowStates = ['PF_AWAITING_TYPE', 'PF_AWAITING_SIZE', 'PF_AWAITING_OCCASION', 'PF_AWAITING_QUANTITY', 'PF_AWAITING_PHOTO', 'PF_AWAITING_NAME', 'AC_AWAITING_TYPE', 'AC_AWAITING_SPEC', 'AC_AWAITING_OCCASION', 'AC_AWAITING_QUANTITY', 'AC_AWAITING_PHOTO', 'AC_AWAITING_NAME', 'OTHER_AWAITING_DETAILS']
  if (midFlowStates.includes(state)) {
    const mLower = m.toLowerCase()
    if (mLower === 'menu' || mLower === 'start over') {
      return {
        reply: p.messages['welcome'] || `Hey! 👋 What can we help you with today?`,
        nextState: 'ENQUIRY_LISTENING',
        nextContext: {},
        done: false,
      }
    }
  }

  // ── IDLE: first message from customer ─────────────────────────────────────
  // Called when state === 'IDLE' and enquiry_mode is on.
  if (state === 'IDLE') {
    if (isGreeting(m)) {
      const greeting = p.messages['welcome'] || `Hey! 👋 What can we help you with today?`
      return {
        reply: greeting,
        nextState: 'ENQUIRY_LISTENING',
        nextContext: { ...context, enquiryAnswers: {} },
        done: false,
      }
    }
    // Has intent — fall through to AWAITING_CATEGORY logic with same message
    return handleEnquiryState({ ...p, state: 'AWAITING_CATEGORY' })
  }

  // ── AWAITING_CATEGORY / ENQUIRY_LISTENING: detect what they want ──────────
  if (state === 'AWAITING_CATEGORY' || state === 'ENQUIRY_LISTENING') {
    const detected = detectProduct(m, keywords)

    if (detected === 'photo_frame') {
      return {
        reply: FRAME_GROUP_MENU,
        nextState: 'PF_AWAITING_TYPE',
        nextContext: { ...context, enquiryProduct: 'Photo Frame', enquiryAnswers: {} },
        done: false,
      }
    }

    if (detected === 'acrylic') {
      return {
        reply: ACRYLIC_TYPE_MENU,
        nextState: 'AC_AWAITING_TYPE',
        nextContext: { ...context, enquiryProduct: 'Acrylic', enquiryAnswers: {} },
        done: false,
      }
    }

    // Unrecognised
    return {
      reply: `We didn't quite catch that! 😊 Please type your name, phone number, and what you need — our team will get back to you.`,
      nextState: 'OTHER_AWAITING_DETAILS',
      nextContext: { ...context, enquiryProduct: 'Other Enquiry', enquiryAnswers: {} },
      done: false,
    }
  }

  // ── PHOTO FRAME: type selection ───────────────────────────────────────────
  if (state === 'PF_AWAITING_TYPE') {
    const n = parseInt(m, 10)
    if (isNaN(n) || n < 1 || n > FRAME_GROUPS.length) {
      return {
        reply: `Please reply with a number between 1 and ${FRAME_GROUPS.length}.\n\n${FRAME_GROUP_MENU}`,
        nextState: 'PF_AWAITING_TYPE',
        nextContext: context,
        done: false,
      }
    }
    const group = FRAME_GROUPS[n - 1]
    return {
      reply: `Great — *${group.label}*! 📸\n\nWhat size do you need?\n\n1. 4×6  2. 5×7  3. 6×8  4. 8×10  5. 10×12  6. 12×15  7. 12×18  8. 16×20  9. 20×24  10. 20×30  11. Custom\n\nReply with a number or type a custom size.`,
      nextState: 'PF_AWAITING_SIZE',
      nextContext: { ...context, enquiryAnswers: { ...context.enquiryAnswers, frameType: group.label } },
      done: false,
    }
  }

  // ── PHOTO FRAME: size ─────────────────────────────────────────────────────
  if (state === 'PF_AWAITING_SIZE') {
    const n = parseInt(m, 10)
    let sizeLabel: string
    if (!isNaN(n) && n >= 1 && n <= 10) {
      sizeLabel = SIZE_OPTIONS[n - 1]
    } else if (n === 11 || m.toLowerCase().includes('custom')) {
      sizeLabel = 'Custom size'
    } else {
      const extracted = extractFrameSize(m)
      sizeLabel = extracted ? extracted.label : m.trim() || 'Custom size'
    }
    return {
      reply: OCCASION_MENU,
      nextState: 'PF_AWAITING_OCCASION',
      nextContext: { ...context, enquiryAnswers: { ...context.enquiryAnswers, size: sizeLabel } },
      done: false,
    }
  }

  // ── PHOTO FRAME: occasion ─────────────────────────────────────────────────
  if (state === 'PF_AWAITING_OCCASION') {
    const n = parseInt(m, 10)
    const occasionLabel = (!isNaN(n) && n >= 1 && n <= OCCASION_LABELS.length)
      ? OCCASION_LABELS[n - 1]
      : m.trim().slice(0, 80) || 'Not specified'
    return {
      reply: `How many pieces do you need?`,
      nextState: 'PF_AWAITING_QUANTITY',
      nextContext: { ...context, enquiryAnswers: { ...context.enquiryAnswers, occasion: occasionLabel } },
      done: false,
    }
  }

  // ── PHOTO FRAME: quantity ─────────────────────────────────────────────────
  if (state === 'PF_AWAITING_QUANTITY') {
    const qty = parseInt(m, 10)
    const quantity = (!isNaN(qty) && qty > 0) ? String(qty) : m.trim().slice(0, 20) || '1'
    return {
      reply: `Would you like to share a photo now? 📸 (Optional — you can send it later too. Just type *skip* to continue.)`,
      nextState: 'PF_AWAITING_PHOTO',
      nextContext: { ...context, enquiryAnswers: { ...context.enquiryAnswers, quantity } },
      done: false,
    }
  }

  // ── PHOTO FRAME: photo (optional) ─────────────────────────────────────────
  if (state === 'PF_AWAITING_PHOTO') {
    const updatedAnswers = { ...context.enquiryAnswers }

    if (p.numMedia > 0 && p.mediaUrl) {
      updatedAnswers.photoUrl = p.mediaUrl
      if (updatedAnswers.size !== 'Custom size') {
        const currentSize = updatedAnswers.size
          ? FRAME_SIZES.find(s => s.label === updatedAnswers.size || s.name === updatedAnswers.size)
          : undefined
        const suggestion = await suggestFrameFromPhoto(p.mediaUrl, p.twilioAccountSid, p.twilioAuthToken, currentSize)
        let photoNote = `Got the photo! 📸`
        if (suggestion?.isNew) {
          updatedAnswers.suggestedSize = suggestion.bestFit.label
          photoNote += ` Just a heads up — your photo might fit better in a *${suggestion.bestFit.label}* frame. We'll confirm when our team reaches out.`
        }
        return {
          reply: `${photoNote}\n\nAnd your name please?`,
          nextState: 'PF_AWAITING_NAME',
          nextContext: { ...context, enquiryAnswers: updatedAnswers },
          done: false,
        }
      }
      // Custom size — just acknowledge the photo, no suggestion
      return {
        reply: `Got the photo! 📸\n\nAnd your name please?`,
        nextState: 'PF_AWAITING_NAME',
        nextContext: { ...context, enquiryAnswers: updatedAnswers },
        done: false,
      }
    }

    // Skip or text — move on
    return {
      reply: `No problem! And your name please?`,
      nextState: 'PF_AWAITING_NAME',
      nextContext: { ...context, enquiryAnswers: updatedAnswers },
      done: false,
    }
  }

  // ── PHOTO FRAME: name → done ──────────────────────────────────────────────
  if (state === 'PF_AWAITING_NAME') {
    const name = m.split(' ')[0]
    const finalAnswers: Record<string, string> = { ...context.enquiryAnswers, name: m }

    await saveEnquiryAndNotify({
      tenantId: p.tenantId,
      customerPhone: p.customerPhone,
      ownerPhone: p.ownerPhone,
      whatsappNumber: p.whatsappNumber,
      product: finalAnswers.frameType ? `Photo Frame — ${finalAnswers.frameType}` : 'Photo Frame',
      answers: finalAnswers,
    })

    return {
      reply: `Thank you, ${name}! 🙏 We've noted your enquiry — *${finalAnswers.frameType ?? 'Photo Frame'}*, size *${finalAnswers.size ?? 'TBD'}*, qty ${finalAnswers.quantity ?? '1'}, for *${finalAnswers.occasion ?? 'personal use'}*.\n\nOur team will reach out to you shortly. 😊`,
      nextState: 'IDLE',
      nextContext: {},
      done: true,
    }
  }

  // ── ACRYLIC: type selection ───────────────────────────────────────────────
  if (state === 'AC_AWAITING_TYPE') {
    const n = parseInt(m, 10)
    if (isNaN(n) || n < 1 || n > ACRYLIC_TYPES.length) {
      return {
        reply: `Please reply with a number between 1 and ${ACRYLIC_TYPES.length}.\n\n${ACRYLIC_TYPE_MENU}`,
        nextState: 'AC_AWAITING_TYPE',
        nextContext: context,
        done: false,
      }
    }
    const product = ACRYLIC_TYPES[n - 1]
    return {
      reply: product.specPrompt,
      nextState: 'AC_AWAITING_SPEC',
      nextContext: { ...context, enquiryProduct: `Acrylic — ${product.label}`, enquiryAnswers: { acrylicType: product.label } },
      done: false,
    }
  }

  // ── ACRYLIC: spec/size ────────────────────────────────────────────────────
  if (state === 'AC_AWAITING_SPEC') {
    const specText = m.trim() || (p.numMedia > 0 && p.mediaUrl ? '(photo reference)' : '')
    const updatedAnswers: Record<string, string> = {
      ...context.enquiryAnswers,
      spec: specText.slice(0, 100),
    }
    if (p.numMedia > 0 && p.mediaUrl) updatedAnswers.photoUrl = p.mediaUrl
    return {
      reply: OCCASION_MENU,
      nextState: 'AC_AWAITING_OCCASION',
      nextContext: { ...context, enquiryAnswers: updatedAnswers },
      done: false,
    }
  }

  // ── ACRYLIC: occasion ─────────────────────────────────────────────────────
  if (state === 'AC_AWAITING_OCCASION') {
    const n = parseInt(m, 10)
    const occasionLabel = (!isNaN(n) && n >= 1 && n <= OCCASION_LABELS.length)
      ? OCCASION_LABELS[n - 1]
      : m.trim().slice(0, 80) || 'Not specified'
    return {
      reply: `How many pieces do you need?`,
      nextState: 'AC_AWAITING_QUANTITY',
      nextContext: { ...context, enquiryAnswers: { ...context.enquiryAnswers, occasion: occasionLabel } },
      done: false,
    }
  }

  // ── ACRYLIC: quantity ─────────────────────────────────────────────────────
  if (state === 'AC_AWAITING_QUANTITY') {
    const qty = parseInt(m, 10)
    const quantity = (!isNaN(qty) && qty > 0) ? String(qty) : m.trim().slice(0, 20) || '1'
    return {
      reply: `Would you like to share a photo or design reference? 📸 (Optional — type *skip* to continue.)`,
      nextState: 'AC_AWAITING_PHOTO',
      nextContext: { ...context, enquiryAnswers: { ...context.enquiryAnswers, quantity } },
      done: false,
    }
  }

  // ── ACRYLIC: photo (optional) ─────────────────────────────────────────────
  if (state === 'AC_AWAITING_PHOTO') {
    const updatedAnswers: Record<string, string> = { ...context.enquiryAnswers }
    if (p.numMedia > 0 && p.mediaUrl) updatedAnswers.photoUrl = p.mediaUrl
    return {
      reply: `And your name please?`,
      nextState: 'AC_AWAITING_NAME',
      nextContext: { ...context, enquiryAnswers: updatedAnswers },
      done: false,
    }
  }

  // ── ACRYLIC: name → done ──────────────────────────────────────────────────
  if (state === 'AC_AWAITING_NAME') {
    const name = m.split(' ')[0]
    const finalAnswers: Record<string, string> = { ...context.enquiryAnswers, name: m }

    await saveEnquiryAndNotify({
      tenantId: p.tenantId,
      customerPhone: p.customerPhone,
      ownerPhone: p.ownerPhone,
      whatsappNumber: p.whatsappNumber,
      product: context.enquiryProduct || 'Acrylic',
      answers: finalAnswers,
    })

    return {
      reply: `Thank you, ${name}! 🙏 We've noted your enquiry — *${finalAnswers.acrylicType ?? 'Acrylic product'}*, qty ${finalAnswers.quantity ?? '1'}, for *${finalAnswers.occasion ?? 'personal use'}*.\n\nOur team will reach out to you shortly. 😊`,
      nextState: 'IDLE',
      nextContext: {},
      done: true,
    }
  }

  // ── OTHER / UNRECOGNISED: collect all details in one message ──────────────
  if (state === 'OTHER_AWAITING_DETAILS') {
    const finalAnswers: Record<string, string> = {
      details: m.trim().slice(0, 500),
      ...(p.mediaUrl ? { photoUrl: p.mediaUrl } : {}),
    }

    await saveEnquiryAndNotify({
      tenantId: p.tenantId,
      customerPhone: p.customerPhone,
      ownerPhone: p.ownerPhone,
      whatsappNumber: p.whatsappNumber,
      product: 'Other Enquiry',
      answers: finalAnswers,
    })

    return {
      reply: `Thank you! 🙏 Our team has received your message and will reach out to you shortly. 😊`,
      nextState: 'IDLE',
      nextContext: {},
      done: true,
    }
  }

  return null
}
