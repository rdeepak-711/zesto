/**
 * Multi-step enquiry questionnaire for Phoenix Photo Studio.
 * Handles photo frames, acrylic products, and open-ended enquiries.
 *
 * State flow:
 *   IDLE → (welcome) → AWAITING_CATEGORY
 *   AWAITING_CATEGORY → detect product → PF_ / AC_ / OTHER_ states
 *   On completion → save Custom Order, notify owner, reset to IDLE
 */

import { db } from '@/lib/db'
import { saveSession, resetSession, type BotContext, type CartItem } from '@/lib/botSession'
import { sendWhatsApp } from '@/lib/twilio'
import { imageSize } from 'image-size'

// ── Photo frame size table ────────────────────────────────────────────────────

const FRAME_SIZES = [
  { name: '4×6 inches',  price: 200,  aspectW: 4,  aspectH: 6  },
  { name: '5×7 inches',  price: 270,  aspectW: 5,  aspectH: 7  },
  { name: '6×8 inches',  price: 300,  aspectW: 6,  aspectH: 8  },
  { name: '8×8 inches',  price: 350,  aspectW: 8,  aspectH: 8  },
  { name: '5×10 inches', price: 400,  aspectW: 5,  aspectH: 10 },
  { name: '8×10 inches', price: 400,  aspectW: 8,  aspectH: 10 },
  { name: '10×12 inches',price: 550,  aspectW: 10, aspectH: 12 },
  { name: '12×8 inches', price: 450,  aspectW: 12, aspectH: 8  },
  { name: '12×15 inches',price: 750,  aspectW: 12, aspectH: 15 },
  { name: '12×18 inches',price: 900,  aspectW: 12, aspectH: 18 },
  { name: '15×10 inches',price: 650,  aspectW: 15, aspectH: 10 },
  { name: '12×20 inches',price: 1100, aspectW: 12, aspectH: 20 },
  { name: '16×20 inches',price: 1300, aspectW: 16, aspectH: 20 },
  { name: '16×24 inches',price: 1800, aspectW: 16, aspectH: 24 },
  { name: '20×24 inches',price: 2000, aspectW: 20, aspectH: 24 },
  { name: '20×30 inches',price: 2500, aspectW: 20, aspectH: 30 },
]

const FRAME_SIZE_LIST = FRAME_SIZES
  .map((s, i) => `${i + 1}. ${s.name} — ₹${s.price}`)
  .join('\n')

// ── Acrylic clock shapes ──────────────────────────────────────────────────────

const CLOCK_SHAPES = [
  'Circle', 'Square (rounded)', 'Rectangle', 'Cushion',
  'Scalloped', 'Arch', 'Baroque', 'Diamond', 'Multi-panel (4 photos)',
]

const CLOCK_SHAPE_LIST = CLOCK_SHAPES.map((s, i) => `${i + 1}. ${s}`).join('\n')

// ── Acrylic lamp shapes ───────────────────────────────────────────────────────

const LAMP_SHAPES = ['Heart', 'Arch', 'Oval', 'House', 'Rectangle', 'Round']
const LAMP_SHAPE_LIST = LAMP_SHAPES.map((s, i) => `${i + 1}. ${s}`).join('\n')

// ── Context type extensions ───────────────────────────────────────────────────

export type EnquiryAnswers = {
  product?: string
  size?: string
  quantity?: string
  shape?: string
  lampType?: string
  photoUrl?: string
  details?: string
  suggestedSize?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseChoice(body: string, max: number): number | null {
  const n = parseInt(body.trim(), 10)
  return n >= 1 && n <= max ? n : null
}

/** Find best matching frame size by aspect ratio. Returns null if the selected size is fine. */
async function checkPhotoAspectRatio(
  mediaUrl: string,
  twilioAccountSid: string,
  twilioAuthToken: string,
  selectedSizeName: string,
): Promise<string | null> {
  try {
    const res = await fetch(mediaUrl, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64') },
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const { width, height } = imageSize(buf)
    if (!width || !height) return null

    const photoRatio = width / height
    const selected = FRAME_SIZES.find(s => s.name === selectedSizeName)
    if (!selected) return null

    const selectedRatio = selected.aspectW / selected.aspectH
    const diff = Math.abs(photoRatio - selectedRatio) / selectedRatio

    // If within 15% of selected ratio, it's fine
    if (diff <= 0.15) return null

    // Find best matching frame
    const best = FRAME_SIZES.reduce((prev, cur) => {
      const curDiff = Math.abs(photoRatio - cur.aspectW / cur.aspectH)
      const prevDiff = Math.abs(photoRatio - prev.aspectW / prev.aspectH)
      return curDiff < prevDiff ? cur : prev
    })

    if (best.name === selectedSizeName) return null
    return best.name
  } catch {
    return null
  }
}

/** Save completed enquiry as a Custom Order and notify owner. */
async function saveEnquiry(params: {
  tenantId: string
  customerPhone: string
  ownerPhone: string
  whatsappNumber: string
  answers: EnquiryAnswers
  originalBody: string
}) {
  const { tenantId, customerPhone, ownerPhone, whatsappNumber, answers } = params

  const customCat = await db.menuCategory.findFirst({
    where: { tenantId, isCustom: true },
  })
  const customItem = customCat
    ? await db.menuItem.findFirst({ where: { tenantId, categoryId: customCat.id } })
    : null

  // Build human-readable notes from answers
  const noteLines: string[] = []
  if (answers.product)    noteLines.push(`Product: ${answers.product}`)
  if (answers.size)       noteLines.push(`Size: ${answers.size}`)
  if (answers.quantity)   noteLines.push(`Qty: ${answers.quantity}`)
  if (answers.shape)      noteLines.push(`Shape: ${answers.shape}`)
  if (answers.lampType)   noteLines.push(`Lamp type: ${answers.lampType}`)
  if (answers.photoUrl)   noteLines.push(`Photo: ${answers.photoUrl}`)
  if (answers.suggestedSize) noteLines.push(`⚠️ Suggested size: ${answers.suggestedSize}`)
  if (answers.details)    noteLines.push(`Details: ${answers.details}`)

  const notes = noteLines.join('\n')

  const prevOrder = await db.order.findFirst({
    where: { tenantId, customerPhone },
    orderBy: { createdAt: 'desc' },
    select: { customerName: true },
  })

  if (!customItem) return

  const order = await db.order.create({
    data: {
      tenantId,
      customerPhone,
      customerName: prevOrder?.customerName ?? 'WhatsApp Enquiry',
      totalAmount: 0,
      notes,
      paymentMethod: 'ONLINE',
      items: {
        create: [{
          menuItemId: customItem.id,
          name: answers.product ?? 'Enquiry',
          price: 0,
          quantity: parseInt(answers.quantity ?? '1', 10) || 1,
          fieldsJson: '[]',
        }],
      },
    },
  })

  // Notify owner with full details
  const shortId = order.id.slice(0, 8).toUpperCase()
  const ownerMsg =
    `📩 *New Enquiry #${shortId}*\n\n` +
    `📱 ${customerPhone}\n\n` +
    noteLines.join('\n') +
    `\n\nReply to this customer on WhatsApp to confirm details & pricing.`

  await sendWhatsApp(ownerPhone, ownerMsg, whatsappNumber)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export type EnquiryHandlerParams = {
  tenantId: string
  customerPhone: string
  ownerPhone: string
  whatsappNumber: string
  body: string
  mediaUrl?: string     // Twilio MediaUrl0 if customer sent a photo
  numMedia: number      // Twilio NumMedia field
  state: string
  context: BotContext & { enquiryAnswers?: EnquiryAnswers }
  messages: Record<string, string>
  twilioAccountSid: string
  twilioAuthToken: string
}

type EnquiryResult = {
  reply: string
  nextState: string
  nextContext: BotContext & { enquiryAnswers?: EnquiryAnswers }
  done: boolean         // true = save order + reset session after sending reply
}

export async function handleEnquiryState(params: EnquiryHandlerParams): Promise<EnquiryResult | null> {
  const { body, state, context, mediaUrl, numMedia } = params
  const m = body.trim().toLowerCase()
  const answers: EnquiryAnswers = context.enquiryAnswers ?? {}

  // ── AWAITING_CATEGORY: route to product flow ──────────────────────────────
  if (state === 'AWAITING_CATEGORY') {
    const pfKeywords = (params.messages['enquiry_keywords'] ?? 'frame,photo frame')
      .split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
    const isPhotoFrame = pfKeywords.some(kw => m.includes(kw))
    const isAcrylic = m.includes('acrylic')

    if (isPhotoFrame) {
      return {
        reply: `📐 *Photo Frames* — here are our sizes:\n\n${FRAME_SIZE_LIST}\n\nWhich size would you like? (reply with the number or the size name)`,
        nextState: 'PF_AWAITING_SIZE',
        nextContext: { ...context, enquiryAnswers: { product: 'Photo Frame' } },
        done: false,
      }
    }

    if (isAcrylic) {
      return {
        reply: `🎨 We offer these acrylic products:\n\n1. 🕐 Acrylic Wall Clock\n2. ✂️ Acrylic Photo Cutout\n3. 💡 Acrylic Night Lamp\n4. 🖼️ Acrylic Print\n\nWhich one are you interested in? (reply with a number)`,
        nextState: 'AC_AWAITING_SUBTYPE',
        nextContext: { ...context, enquiryAnswers: { product: 'Acrylic' } },
        done: false,
      }
    }

    // Other — ask for full details
    return {
      reply: `🙏 We'd love to help! Please share full details of what you're looking for — product type, size, occasion, any special requirements.`,
      nextState: 'OTHER_AWAITING_DETAILS',
      nextContext: { ...context, enquiryAnswers: {} },
      done: false,
    }
  }

  // ── PHOTO FRAME flow ──────────────────────────────────────────────────────

  if (state === 'PF_AWAITING_SIZE') {
    // Try numbered choice first
    const choice = parseChoice(m, FRAME_SIZES.length)
    let matched: typeof FRAME_SIZES[0] | undefined

    if (choice !== null) {
      matched = FRAME_SIZES[choice - 1]
    } else {
      // Try name match
      matched = FRAME_SIZES.find(s => m.includes(s.name.toLowerCase().replace(' inches', '').replace('×', 'x').replace('×', '×')))
      if (!matched) {
        matched = FRAME_SIZES.find(s => {
          const normalized = s.name.toLowerCase().replace(' inches', '')
          return m.replace('x', '×').includes(normalized) || m.includes(normalized.replace('×', 'x'))
        })
      }
    }

    if (!matched) {
      return {
        reply: `Please pick a size from the list (reply with 1–${FRAME_SIZES.length}):\n\n${FRAME_SIZE_LIST}`,
        nextState: 'PF_AWAITING_SIZE',
        nextContext: context,
        done: false,
      }
    }

    return {
      reply: `✅ *${matched.name}* — ₹${matched.price}\n\nHow many frames do you need?`,
      nextState: 'PF_AWAITING_QUANTITY',
      nextContext: { ...context, enquiryAnswers: { ...answers, size: matched.name } },
      done: false,
    }
  }

  if (state === 'PF_AWAITING_QUANTITY') {
    const qty = parseInt(m, 10)
    if (isNaN(qty) || qty < 1 || qty > 100) {
      return {
        reply: `How many frames do you need? (please enter a number)`,
        nextState: 'PF_AWAITING_QUANTITY',
        nextContext: context,
        done: false,
      }
    }

    return {
      reply: `Got it — ${qty} frame${qty > 1 ? 's' : ''} 👍\n\n📸 Please share the photo you'd like to frame, or type *skip* to share it later.`,
      nextState: 'PF_AWAITING_PHOTO',
      nextContext: { ...context, enquiryAnswers: { ...answers, quantity: String(qty) } },
      done: false,
    }
  }

  if (state === 'PF_AWAITING_PHOTO') {
    let photoUrl: string | undefined
    let suggestedSize: string | undefined

    if (numMedia > 0 && mediaUrl) {
      photoUrl = mediaUrl
      // Check aspect ratio against selected size
      const suggestion = await checkPhotoAspectRatio(
        mediaUrl,
        params.twilioAccountSid,
        params.twilioAuthToken,
        answers.size ?? '',
      )
      if (suggestion) {
        suggestedSize = suggestion
      }
    }

    const updatedAnswers: EnquiryAnswers = { ...answers, photoUrl, suggestedSize }

    await saveEnquiry({
      tenantId: params.tenantId,
      customerPhone: params.customerPhone,
      ownerPhone: params.ownerPhone,
      whatsappNumber: params.whatsappNumber,
      answers: updatedAnswers,
      originalBody: body,
    })

    let reply = `🙏 Thank you! We've received your enquiry for a *${answers.size}* photo frame (${answers.quantity ?? '1'} piece).`
    if (suggestedSize) {
      reply += `\n\n💡 *Heads up:* Based on your photo's dimensions, a *${suggestedSize}* frame might be a better fit — we'll confirm with you!`
    }
    reply += `\n\nThe owner will reach out to you shortly to confirm details. 😊`

    return { reply, nextState: 'IDLE', nextContext: {}, done: true }
  }

  // ── ACRYLIC: sub-type selection ───────────────────────────────────────────

  if (state === 'AC_AWAITING_SUBTYPE') {
    const choice = parseChoice(m, 4)
    if (!choice) {
      return {
        reply: `Please pick one:\n\n1. 🕐 Acrylic Wall Clock\n2. ✂️ Acrylic Photo Cutout\n3. 💡 Acrylic Night Lamp\n4. 🖼️ Acrylic Print`,
        nextState: 'AC_AWAITING_SUBTYPE',
        nextContext: context,
        done: false,
      }
    }

    const subTypes: Record<number, { label: string; state: string; reply: string }> = {
      1: {
        label: 'Acrylic Wall Clock',
        state: 'AC_CLOCK_AWAITING_SHAPE',
        reply: `🕐 *Acrylic Photo Wall Clock* — ₹1100 (10in) · ₹1400 (12in) · ₹1700 (16in)\n\nChoose a shape:\n\n${CLOCK_SHAPE_LIST}\n\nReply with a number.`,
      },
      2: {
        label: 'Acrylic Photo Cutout',
        state: 'AC_CUTOUT_AWAITING_SIZE',
        reply: `✂️ *Acrylic Photo Cutout*\n\nChoose size:\n\n1. Large (12×8 in) — ₹1300\n2. Small (6×8 in) — ₹700`,
      },
      3: {
        label: 'Acrylic Night Lamp',
        state: 'AC_LAMP_AWAITING_TYPE',
        reply: `💡 *Acrylic Night Lamp* — ₹600\n\nChoose style:\n\n1. Engraving (photo etched into acrylic — elegant glow)\n2. Color Print (full color photo — vibrant)\n\nWhich do you prefer?`,
      },
      4: {
        label: 'Acrylic Print',
        state: 'AC_PRINT_AWAITING_SIZE',
        reply: `🖼️ *Acrylic Print (4mm)*\n\nWhat size would you like? (e.g. A4, A3, 8×10 in, or describe your requirement)`,
      },
    }

    const sub = subTypes[choice]
    return {
      reply: sub.reply,
      nextState: sub.state,
      nextContext: { ...context, enquiryAnswers: { ...answers, product: sub.label } },
      done: false,
    }
  }

  // ── ACRYLIC WALL CLOCK ────────────────────────────────────────────────────

  if (state === 'AC_CLOCK_AWAITING_SHAPE') {
    const choice = parseChoice(m, CLOCK_SHAPES.length)
    if (!choice) {
      return {
        reply: `Please pick a shape (1–${CLOCK_SHAPES.length}):\n\n${CLOCK_SHAPE_LIST}`,
        nextState: 'AC_CLOCK_AWAITING_SHAPE',
        nextContext: context,
        done: false,
      }
    }
    const shape = CLOCK_SHAPES[choice - 1]
    return {
      reply: `✅ *${shape}* shape selected!\n\nWhat size would you like?\n\n1. 10 inch — ₹1100\n2. 12 inch — ₹1400\n3. 16 inch — ₹1700`,
      nextState: 'AC_CLOCK_AWAITING_SIZE',
      nextContext: { ...context, enquiryAnswers: { ...answers, shape } },
      done: false,
    }
  }

  if (state === 'AC_CLOCK_AWAITING_SIZE') {
    const sizeMap: Record<number, string> = { 1: '10 inch — ₹1100', 2: '12 inch — ₹1400', 3: '16 inch — ₹1700' }
    const choice = parseChoice(m, 3)
    if (!choice) {
      return {
        reply: `Please pick a size:\n\n1. 10 inch — ₹1100\n2. 12 inch — ₹1400\n3. 16 inch — ₹1700`,
        nextState: 'AC_CLOCK_AWAITING_SIZE',
        nextContext: context,
        done: false,
      }
    }
    return {
      reply: `Got it! 📸 Please share the photo for your clock, or type *skip* if you'll share it later.`,
      nextState: 'AC_CLOCK_AWAITING_PHOTO',
      nextContext: { ...context, enquiryAnswers: { ...answers, size: sizeMap[choice] } },
      done: false,
    }
  }

  if (state === 'AC_CLOCK_AWAITING_PHOTO') {
    const photoUrl = (numMedia > 0 && mediaUrl) ? mediaUrl : undefined
    const updatedAnswers: EnquiryAnswers = { ...answers, photoUrl }

    await saveEnquiry({
      tenantId: params.tenantId,
      customerPhone: params.customerPhone,
      ownerPhone: params.ownerPhone,
      whatsappNumber: params.whatsappNumber,
      answers: updatedAnswers,
      originalBody: body,
    })

    const reply = `🙏 Thank you! We've received your enquiry for an *Acrylic Wall Clock* (${answers.shape}, ${answers.size}).\n\nThe owner will reach out shortly to confirm. 😊`
    return { reply, nextState: 'IDLE', nextContext: {}, done: true }
  }

  // ── ACRYLIC CUTOUT ────────────────────────────────────────────────────────

  if (state === 'AC_CUTOUT_AWAITING_SIZE') {
    const sizeMap: Record<number, string> = { 1: 'Large (12×8 in) — ₹1300', 2: 'Small (6×8 in) — ₹700' }
    const choice = parseChoice(m, 2)
    if (!choice) {
      return {
        reply: `Please choose:\n\n1. Large (12×8 in) — ₹1300\n2. Small (6×8 in) — ₹700`,
        nextState: 'AC_CUTOUT_AWAITING_SIZE',
        nextContext: context,
        done: false,
      }
    }
    return {
      reply: `Got it! 📸 Please share the photo for the cutout, or type *skip* to share later.`,
      nextState: 'AC_CUTOUT_AWAITING_PHOTO',
      nextContext: { ...context, enquiryAnswers: { ...answers, size: sizeMap[choice] } },
      done: false,
    }
  }

  if (state === 'AC_CUTOUT_AWAITING_PHOTO') {
    const photoUrl = (numMedia > 0 && mediaUrl) ? mediaUrl : undefined
    await saveEnquiry({
      tenantId: params.tenantId,
      customerPhone: params.customerPhone,
      ownerPhone: params.ownerPhone,
      whatsappNumber: params.whatsappNumber,
      answers: { ...answers, photoUrl },
      originalBody: body,
    })
    const reply = `🙏 Thank you! Enquiry received for an *Acrylic Photo Cutout* (${answers.size}).\n\nThe owner will reach out shortly. 😊`
    return { reply, nextState: 'IDLE', nextContext: {}, done: true }
  }

  // ── ACRYLIC NIGHT LAMP ────────────────────────────────────────────────────

  if (state === 'AC_LAMP_AWAITING_TYPE') {
    const typeMap: Record<number, string> = { 1: 'Engraving', 2: 'Color Print' }
    const choice = parseChoice(m, 2)
    if (!choice) {
      return {
        reply: `Please pick a style:\n\n1. Engraving (elegant glow)\n2. Color Print (vibrant colors)`,
        nextState: 'AC_LAMP_AWAITING_TYPE',
        nextContext: context,
        done: false,
      }
    }
    return {
      reply: `Great choice! 🌟 Choose a shape:\n\n${LAMP_SHAPE_LIST}\n\nReply with a number.`,
      nextState: 'AC_LAMP_AWAITING_SHAPE',
      nextContext: { ...context, enquiryAnswers: { ...answers, lampType: typeMap[choice] } },
      done: false,
    }
  }

  if (state === 'AC_LAMP_AWAITING_SHAPE') {
    const choice = parseChoice(m, LAMP_SHAPES.length)
    if (!choice) {
      return {
        reply: `Please pick a shape (1–${LAMP_SHAPES.length}):\n\n${LAMP_SHAPE_LIST}`,
        nextState: 'AC_LAMP_AWAITING_SHAPE',
        nextContext: context,
        done: false,
      }
    }
    const shape = LAMP_SHAPES[choice - 1]
    return {
      reply: `✅ *${shape}* shape! 📸 Please share the photo for the lamp, or type *skip* to share later.`,
      nextState: 'AC_LAMP_AWAITING_PHOTO',
      nextContext: { ...context, enquiryAnswers: { ...answers, shape } },
      done: false,
    }
  }

  if (state === 'AC_LAMP_AWAITING_PHOTO') {
    const photoUrl = (numMedia > 0 && mediaUrl) ? mediaUrl : undefined
    await saveEnquiry({
      tenantId: params.tenantId,
      customerPhone: params.customerPhone,
      ownerPhone: params.ownerPhone,
      whatsappNumber: params.whatsappNumber,
      answers: { ...answers, photoUrl },
      originalBody: body,
    })
    const reply = `🙏 Thank you! Enquiry received for an *Acrylic Night Lamp* (${answers.lampType}, ${answers.shape} shape).\n\nThe owner will reach out shortly. 😊`
    return { reply, nextState: 'IDLE', nextContext: {}, done: true }
  }

  // ── ACRYLIC PRINT ─────────────────────────────────────────────────────────

  if (state === 'AC_PRINT_AWAITING_SIZE') {
    if (m.length < 2) {
      return {
        reply: `Please describe the size you need (e.g. A4, A3, 8×10 in, or custom dimensions).`,
        nextState: 'AC_PRINT_AWAITING_SIZE',
        nextContext: context,
        done: false,
      }
    }
    return {
      reply: `Got it! 📸 Please share the photo for your acrylic print, or type *skip* to share later.`,
      nextState: 'AC_PRINT_AWAITING_PHOTO',
      nextContext: { ...context, enquiryAnswers: { ...answers, size: body.trim() } },
      done: false,
    }
  }

  if (state === 'AC_PRINT_AWAITING_PHOTO') {
    const photoUrl = (numMedia > 0 && mediaUrl) ? mediaUrl : undefined
    await saveEnquiry({
      tenantId: params.tenantId,
      customerPhone: params.customerPhone,
      ownerPhone: params.ownerPhone,
      whatsappNumber: params.whatsappNumber,
      answers: { ...answers, photoUrl },
      originalBody: body,
    })
    const reply = `🙏 Thank you! Enquiry received for an *Acrylic Print* (${answers.size}).\n\nThe owner will reach out shortly. 😊`
    return { reply, nextState: 'IDLE', nextContext: {}, done: true }
  }

  // ── OTHER enquiry ─────────────────────────────────────────────────────────

  if (state === 'OTHER_AWAITING_DETAILS') {
    await saveEnquiry({
      tenantId: params.tenantId,
      customerPhone: params.customerPhone,
      ownerPhone: params.ownerPhone,
      whatsappNumber: params.whatsappNumber,
      answers: { product: 'Other Enquiry', details: body },
      originalBody: body,
    })
    const reply = params.messages['enquiry_other']
      ?? `🙏 Thank you for reaching out!\n\nThe owner has noted your message and will contact you shortly.`
    return { reply, nextState: 'IDLE', nextContext: {}, done: true }
  }

  return null // state not handled by enquiry module
}
