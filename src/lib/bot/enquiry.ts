/**
 * Conversational enquiry handler for Phoenix Photo Studio.
 *
 * Philosophy: customer leads, bot follows.
 * - No forced welcome. Bot reacts to the customer's first message.
 * - Detect product intent from natural language, never force numbered menus.
 * - Collect name + date organically at the end of each flow.
 * - Save a clean summary to the order notes & notify owner.
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

// ── Intent detection ──────────────────────────────────────────────────────────

const GREETING_PATTERNS = /^(hi+|hello|hey|hii+|hai|good\s*(morning|evening|afternoon|night)|namaste|sup|yo|howdy)\W*$/i

function isGreeting(text: string): boolean {
  return GREETING_PATTERNS.test(text.trim())
}

function detectProduct(text: string, enquiryKeywords: string): 'photo_frame' | 'acrylic' | 'other' {
  const m = text.toLowerCase()
  const pfKeywords = enquiryKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
  if (pfKeywords.some(kw => m.includes(kw))) return 'photo_frame'
  if (m.includes('acrylic')) return 'acrylic'
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
    const best = FRAME_SIZES.reduce((prev, cur) => {
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
  if (answers.size)      lines.push(`Size: ${answers.size}`)
  if (answers.quantity)  lines.push(`Quantity: ${answers.quantity}`)
  if (answers.shape)     lines.push(`Shape: ${answers.shape}`)
  if (answers.details)   lines.push(`Details: ${answers.details}`)
  if (answers.photoUrl)  lines.push(`Photo: ${answers.photoUrl}`)
  if (answers.suggestedSize) lines.push(`⚠️ Photo fits better in: ${answers.suggestedSize}`)
  if (answers.date)      lines.push(`Needed by: ${answers.date}`)
  if (answers.name)      lines.push(`Customer name: ${answers.name}`)
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
  if (!customItem) return

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
  const answers: Record<string, string> = context.enquiryAnswers ?? {}
  const product = context.enquiryProduct ?? ''
  const keywords = p.messages['enquiry_keywords'] ?? 'frame,photo frame,acrylic'

  // ── IDLE: first message from customer ─────────────────────────────────────
  // Called when state === 'IDLE' and enquiry_mode is on.
  if (state === 'IDLE') {
    if (isGreeting(m)) {
      return {
        reply: `Hey! 👋 What can we help you with today?`,
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
      // Check if they already mentioned a size
      const sizeMatch = extractFrameSize(m)
      if (sizeMatch) {
        // Check if they also sent a photo
        if (p.numMedia > 0 && p.mediaUrl) {
          const suggestion = await suggestFrameFromPhoto(p.mediaUrl, p.twilioAccountSid, p.twilioAuthToken, sizeMatch)
          let reply = `Got it! A *${sizeMatch.label}* frame`
          const updatedAnswers: Record<string, string> = { ...answers, size: sizeMatch.label, photoUrl: p.mediaUrl }
          if (suggestion?.isNew) {
            reply += ` — though based on your photo, a *${suggestion.bestFit.label}* might actually be a better fit. We'll confirm with you!`
            updatedAnswers.suggestedSize = suggestion.bestFit.label
          } else {
            reply += ` — photo looks great for that size!`
          }
          reply += `\n\nWhen do you need it by?`
          return {
            reply,
            nextState: 'PF_AWAITING_DATE',
            nextContext: { ...context, enquiryProduct: 'Photo Frame', enquiryAnswers: updatedAnswers },
            done: false,
          }
        }
        return {
          reply: `*${sizeMatch.label}* — perfect choice! 📸 Do you have the photo ready to share? Send it here if you do, or just let us know and we'll sort it out.`,
          nextState: 'PF_AWAITING_PHOTO',
          nextContext: { ...context, enquiryProduct: 'Photo Frame', enquiryAnswers: { ...answers, size: sizeMatch.label } },
          done: false,
        }
      }

      // No size mentioned — ask naturally
      return {
        reply: `Sure! We do frames from 4×6 all the way up to 20×30 inches. Did you have a size in mind, or would you like to share the photo first so we can suggest the right fit?`,
        nextState: 'PF_AWAITING_SIZE',
        nextContext: { ...context, enquiryProduct: 'Photo Frame', enquiryAnswers: answers },
        done: false,
      }
    }

    if (detected === 'acrylic') {
      return {
        reply: `We do beautiful personalised acrylic pieces — wall clocks with your photo, life-size cutouts, glowing night lamps, and flat prints. What did you have in mind?`,
        nextState: 'AC_AWAITING_DETAILS',
        nextContext: { ...context, enquiryProduct: 'Acrylic', enquiryAnswers: answers },
        done: false,
      }
    }

    // Other
    return {
      reply: `Tell us more! What are you looking for — size, occasion, any details you have in mind would really help.`,
      nextState: 'OTHER_AWAITING_DETAILS',
      nextContext: { ...context, enquiryProduct: 'Other Enquiry', enquiryAnswers: answers },
      done: false,
    }
  }

  // ── PHOTO FRAME: size step ────────────────────────────────────────────────
  if (state === 'PF_AWAITING_SIZE') {
    // Maybe they sent a photo instead
    if (p.numMedia > 0 && p.mediaUrl) {
      const suggestion = await suggestFrameFromPhoto(p.mediaUrl, p.twilioAccountSid, p.twilioAuthToken)
      const updatedAnswers: Record<string, string> = { ...answers, photoUrl: p.mediaUrl }
      let reply: string
      if (suggestion) {
        updatedAnswers.size = suggestion.bestFit.label
        reply = `Based on your photo, a *${suggestion.bestFit.label}* frame would be a great fit! 👌 When do you need it by?`
      } else {
        reply = `Got the photo! 📸 When do you need it by?`
      }
      return {
        reply,
        nextState: 'PF_AWAITING_DATE',
        nextContext: { ...context, enquiryAnswers: updatedAnswers },
        done: false,
      }
    }

    const sizeMatch = extractFrameSize(m)
    if (sizeMatch) {
      return {
        reply: `*${sizeMatch.label}* — great! 📸 Do you have the photo ready? Send it here or we can follow up later.`,
        nextState: 'PF_AWAITING_PHOTO',
        nextContext: { ...context, enquiryAnswers: { ...answers, size: sizeMatch.label } },
        done: false,
      }
    }

    // Can't parse size — try to help
    const lm = m.toLowerCase()
    if (lm.includes('not sure') || lm.includes('don\'t know') || lm.includes("don't know") || lm.includes('no idea')) {
      return {
        reply: `No worries! Share your photo here and we'll suggest the perfect size for you. 📸`,
        nextState: 'PF_AWAITING_PHOTO',
        nextContext: { ...context, enquiryAnswers: answers },
        done: false,
      }
    }

    return {
      reply: `We have sizes from 4×6 up to 20×30 inches. Which size were you thinking? (or just share your photo and we'll suggest the best fit!)`,
      nextState: 'PF_AWAITING_SIZE',
      nextContext: context,
      done: false,
    }
  }

  // ── PHOTO FRAME: photo step ───────────────────────────────────────────────
  if (state === 'PF_AWAITING_PHOTO') {
    const updatedAnswers = { ...answers }

    if (p.numMedia > 0 && p.mediaUrl) {
      updatedAnswers.photoUrl = p.mediaUrl
      const currentSize = answers.size ? FRAME_SIZES.find(s => s.label === answers.size) : undefined
      const suggestion = await suggestFrameFromPhoto(p.mediaUrl, p.twilioAccountSid, p.twilioAuthToken, currentSize)

      let reply = `Got the photo!`
      if (suggestion?.isNew) {
        updatedAnswers.suggestedSize = suggestion.bestFit.label
        if (!answers.size) {
          updatedAnswers.size = suggestion.bestFit.label
          reply += ` Based on your photo, a *${suggestion.bestFit.label}* frame would look great.`
        } else {
          reply += ` Just a heads up — your photo might fit better in a *${suggestion.bestFit.label}* frame. We'll confirm when the owner reaches out.`
        }
      }

      reply += ` When do you need it by?`
      return {
        reply,
        nextState: 'PF_AWAITING_DATE',
        nextContext: { ...context, enquiryAnswers: updatedAnswers },
        done: false,
      }
    }

    // No photo — they typed something
    if (m.toLowerCase() === 'skip' || m.toLowerCase().includes('later') || m.toLowerCase().includes('share later')) {
      return {
        reply: `No problem, you can share it later! When do you need the frame by?`,
        nextState: 'PF_AWAITING_DATE',
        nextContext: { ...context, enquiryAnswers: updatedAnswers },
        done: false,
      }
    }

    // They might be describing the photo
    updatedAnswers.details = (updatedAnswers.details ? updatedAnswers.details + '; ' : '') + m
    return {
      reply: `Got it! When do you need it by?`,
      nextState: 'PF_AWAITING_DATE',
      nextContext: { ...context, enquiryAnswers: updatedAnswers },
      done: false,
    }
  }

  // ── PHOTO FRAME: date step ────────────────────────────────────────────────
  if (state === 'PF_AWAITING_DATE') {
    return {
      reply: `And your name please? So we know who it's for. 😊`,
      nextState: 'PF_AWAITING_NAME',
      nextContext: { ...context, enquiryAnswers: { ...answers, date: m } },
      done: false,
    }
  }

  // ── PHOTO FRAME: name step → done ─────────────────────────────────────────
  if (state === 'PF_AWAITING_NAME') {
    const name = m.split(' ')[0] // first word as name
    const finalAnswers = { ...answers, name: m }

    await saveEnquiryAndNotify({
      tenantId: p.tenantId,
      customerPhone: p.customerPhone,
      ownerPhone: p.ownerPhone,
      whatsappNumber: p.whatsappNumber,
      product: 'Photo Frame',
      answers: finalAnswers,
    })

    const sizeNote = answers.suggestedSize
      ? ` We'll also check if a *${answers.suggestedSize}* might be a better fit for your photo.`
      : ''

    return {
      reply: `Thank you, ${name}! 🙏 We've noted your enquiry for${answers.size ? ` a *${answers.size}*` : ' a'} photo frame${answers.date ? ` needed by ${answers.date}` : ''}.${sizeNote}\n\nThe owner will reach out to confirm everything shortly. 😊`,
      nextState: 'IDLE',
      nextContext: {},
      done: true,
    }
  }

  // ── ACRYLIC: details step ─────────────────────────────────────────────────
  if (state === 'AC_AWAITING_DETAILS') {
    const updatedAnswers: Record<string, string> = { ...answers, details: m }

    // If they also sent a photo, save the URL
    if (p.numMedia > 0 && p.mediaUrl) updatedAnswers.photoUrl = p.mediaUrl

    return {
      reply: `Lovely! When do you need it by?`,
      nextState: 'AC_AWAITING_DATE',
      nextContext: { ...context, enquiryAnswers: updatedAnswers },
      done: false,
    }
  }

  // ── ACRYLIC: date step ────────────────────────────────────────────────────
  if (state === 'AC_AWAITING_DATE') {
    return {
      reply: `And your name please?`,
      nextState: 'AC_AWAITING_NAME',
      nextContext: { ...context, enquiryAnswers: { ...answers, date: m } },
      done: false,
    }
  }

  // ── ACRYLIC: name step → done ─────────────────────────────────────────────
  if (state === 'AC_AWAITING_NAME') {
    const name = m.split(' ')[0]
    const finalAnswers = { ...answers, name: m }

    await saveEnquiryAndNotify({
      tenantId: p.tenantId,
      customerPhone: p.customerPhone,
      ownerPhone: p.ownerPhone,
      whatsappNumber: p.whatsappNumber,
      product: product || 'Acrylic',
      answers: finalAnswers,
    })

    return {
      reply: `Thank you, ${name}! 🙏 We've noted your enquiry${answers.date ? ` — needed by ${answers.date}` : ''}.\n\nThe owner will get back to you shortly to confirm the design and details. 😊`,
      nextState: 'IDLE',
      nextContext: {},
      done: true,
    }
  }

  // ── OTHER: details step ───────────────────────────────────────────────────
  if (state === 'OTHER_AWAITING_DETAILS') {
    const updatedAnswers: Record<string, string> = { ...answers, details: m }
    if (p.numMedia > 0 && p.mediaUrl) updatedAnswers.photoUrl = p.mediaUrl

    return {
      reply: `Got it! When do you need it by?`,
      nextState: 'OTHER_AWAITING_DATE',
      nextContext: { ...context, enquiryAnswers: updatedAnswers },
      done: false,
    }
  }

  // ── OTHER: date step ──────────────────────────────────────────────────────
  if (state === 'OTHER_AWAITING_DATE') {
    return {
      reply: `And your name please?`,
      nextState: 'OTHER_AWAITING_NAME',
      nextContext: { ...context, enquiryAnswers: { ...answers, date: m } },
      done: false,
    }
  }

  // ── OTHER: name step → done ───────────────────────────────────────────────
  if (state === 'OTHER_AWAITING_NAME') {
    const name = m.split(' ')[0]
    const finalAnswers = { ...answers, name: m }

    await saveEnquiryAndNotify({
      tenantId: p.tenantId,
      customerPhone: p.customerPhone,
      ownerPhone: p.ownerPhone,
      whatsappNumber: p.whatsappNumber,
      product: 'Other Enquiry',
      answers: finalAnswers,
    })

    return {
      reply: `Thank you, ${name}! 🙏 We've noted everything down.\n\nThe owner will reach out to you shortly. 😊`,
      nextState: 'IDLE',
      nextContext: {},
      done: true,
    }
  }

  return null
}
