import type { CartItem, BotContext, FieldDef, FieldSelection } from '@/lib/botSession'

export type BotState =
  | 'IDLE'
  | 'AWAITING_CATEGORY'
  | 'AWAITING_ITEM'
  | 'AWAITING_FIELD'
  | 'AWAITING_QUANTITY'
  | 'AWAITING_MORE'
  | 'AWAITING_DELIVERY_DATE'
  | 'AWAITING_CONFIRMATION'
  | 'AWAITING_CUSTOM_DESCRIPTION'
  | 'AWAITING_CUSTOM_CONFIRM'
  | 'AWAITING_PAYMENT_METHOD'
  | 'ORDER_PENDING'
  | 'AWAITING_NAME'
  | 'AWAITING_AGE'
  | 'AWAITING_BOOKING_DATE'
  | 'AWAITING_BOOKING_TIME'
  | 'PENDING_BOOKING'

export type Category = { id: string; name: string; sortOrder: number; isCustom: boolean }
export type MenuItem = {
  id: string
  name: string
  price: number
  categoryId: string
  description?: string | null
  imageUrl?: string | null
  productUrl?: string | null
}

export type RawCategoryField = {
  id: string
  categoryId: string
  name: string
  type: 'text' | 'number' | 'select' | 'boolean'
  required: boolean
  placeholder: string | null
  sortOrder: number
  options: { id: string; label: string; priceDelta: number; sortOrder: number }[]
  itemOptions: { menuItemId: string; optionId: string }[]
}

export type DiscountCode = {
  code: string
  type: string
  value: number
  minAmount: number
  maxUses: number
  usedCount: number
  expiresAt: Date | null
}

export type BotMessages = Record<string, string>

export type BotRule = {
  id: number
  state: string
  condition: string
  matchText: string
  reply: string
  nextState: string
  active: boolean
}

export type BotInput = {
  message: string
  state: BotState
  cart: CartItem[]
  context: BotContext
  categories: Category[]
  menuItems: MenuItem[]
  messages: BotMessages
  categoryFields?: RawCategoryField[]
  rules?: BotRule[]
  minOrderAmount?: number
  discountCodes?: DiscountCode[]
  deliveryDateEnabled?: boolean
  deliveryDateLabel?: string
  businessName?: string
  hasBooking?: boolean
}

export type BotOutput = {
  reply: string
  nextState: BotState
  cart: CartItem[]
  context: BotContext
  placeOrder: boolean
}

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

export function itemTotal(item: CartItem): number {
  const fieldDelta = (item.fields ?? []).reduce((s, f) => s + f.priceDelta, 0)
  return (item.price + fieldDelta) * item.quantity
}

function formatCategoryList(categories: Category[]): string {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  return sorted.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}

function msg(messages: BotMessages, key: string, vars: Record<string, string> = {}): string {
  return fill(messages[key] ?? '', vars)
}

function formatItems(items: MenuItem[], categoryName: string, messages: BotMessages): string {
  const lines = items.map((item, i) => {
    const desc = item.description ? `\n   _${item.description}_` : ''
    const link = item.productUrl ? `\n   ${item.productUrl}` : item.imageUrl ? `\n   ${item.imageUrl}` : ''
    return `${i + 1}. *${item.name}* — ${formatPrice(item.price)}${desc}${link}`
  })
  return `*${categoryName}*\n\n` + lines.join('\n\n') + `\n\n` + (messages['items_footer'] ?? 'Reply with a number to select, or *back* to see all categories.')
}

function buildFieldDefs(categoryId: string, itemId: string, rawFields: RawCategoryField[]): FieldDef[] {
  return rawFields
    .filter(f => f.categoryId === categoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(f => {
      const overrideIds = f.itemOptions.filter(io => io.menuItemId === itemId).map(io => io.optionId)
      const visibleOptions = overrideIds.length > 0
        ? f.options.filter(o => overrideIds.includes(o.id))
        : f.options
      return {
        id: f.id,
        name: f.name,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder ?? undefined,
        options: visibleOptions
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(o => ({ id: o.id, label: o.label, priceDelta: o.priceDelta })),
      }
    })
}

function formatFieldPrompt(field: FieldDef, itemName: string, basePrice: number, messages: BotMessages): string {
  if (field.type === 'select') {
    const lines = field.options.map((o, i) => {
      const total = basePrice + o.priceDelta
      return `${i + 1}. ${o.label} — ${formatPrice(total)}`
    })
    return `Which *${field.name}* would you like for *${itemName}*?\n\n${lines.join('\n')}\n\n${messages['field_prompt_footer'] ?? 'Reply with a number to select.'}`
  }
  if (field.type === 'boolean') {
    return `${field.placeholder ?? field.name + '?'} Reply *yes* or *no*.`
  }
  const notRequired = !field.required ? ` (or type *skip* to leave blank)` : ''
  return `${field.placeholder ?? field.name + '?'}${notRequired}`
}

function formatCart(cart: CartItem[], messages: BotMessages): string {
  if (cart.length === 0) return messages['cart_empty'] ?? 'Your cart is empty.'
  const lines = cart.map((item) => {
    const fieldStr = item.fields && item.fields.length > 0
      ? ` (${item.fields.filter(f => f.value).map(f => f.value).join(' · ')})`
      : ''
    return `• ${item.name}${fieldStr} × ${item.quantity} = ${formatPrice(itemTotal(item))}`
  })
  const total = cart.reduce((sum, i) => sum + itemTotal(i), 0)
  return lines.join('\n') + `\n\n*Total: ${formatPrice(total)}*`
}

function formatOrderSummary(cart: CartItem[], context: BotContext, messages: BotMessages): string {
  const cartStr = formatCart(cart, messages)
  const deliveryLine = context.deliveryNote ? `\n\n📅 *Delivery:* ${context.deliveryNote}` : ''
  const discountLine = context.appliedCode && context.appliedDiscount
    ? `\n🏷️ *Discount (${context.appliedCode}):* -${formatPrice(context.appliedDiscount)}`
    : ''
  const finalTotal = cart.reduce((sum, i) => sum + itemTotal(i), 0) - (context.appliedDiscount ?? 0)
  const finalLine = discountLine ? `\n💰 *Final Total: ${formatPrice(finalTotal)}*` : ''
  const codeHint = !context.appliedCode
    ? `\n\n${messages['discount_hint'] ?? 'Have a discount code? Type it now, or type *yes* to confirm.'}`
    : ''
  return msg(messages, 'order_summary', { cart: cartStr }) + deliveryLine + discountLine + finalLine + codeHint
}

function formatAfterAdd(cart: CartItem[], categories: Category[], itemName: string, qty: number, messages: BotMessages): string {
  const cartStr = formatCart(cart, messages)
  const added = msg(messages, 'item_added', { item: itemName, qty: String(qty) })
  const more = msg(messages, 'add_more_prompt', { categories: formatCategoryList(categories) })
  return `${added}\n\n${cartStr}\n\n───────────────\n${more}`
}

function applyDiscount(code: DiscountCode, cartTotal: number): number {
  if (code.type === 'percent') return Math.round((cartTotal * code.value) / 100)
  return Math.min(code.value, cartTotal)
}

function matchesRule(rule: BotRule, message: string, state: BotState): boolean {
  const m = message.trim().toLowerCase()
  const text = rule.matchText.toLowerCase()
  if (rule.state !== '*' && rule.state !== state) return false
  if (rule.condition === 'equals') return m === text
  if (rule.condition === 'contains') return m.includes(text)
  if (rule.condition === 'starts_with') return m.startsWith(text)
  return false
}

export function processMessage(input: BotInput): BotOutput {
  const {
    message, state, cart, context, categories, menuItems, messages,
    categoryFields = [], rules = [], minOrderAmount = 0, discountCodes = [],
    deliveryDateEnabled = true,
    deliveryDateLabel,
    businessName = '',
    hasBooking = false,
  } = input
  const m = message.trim().toLowerCase()
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  // Custom rules checked first
  for (const rule of rules) {
    if (!rule.active) continue
    if (matchesRule(rule, message, state)) {
      const nextState = rule.nextState === 'SAME' ? state : (rule.nextState as BotState)
      return { reply: rule.reply, nextState, cart, context, placeOrder: false }
    }
  }

  // Global commands
  if (m === 'hi' || m === 'hello' || m === 'start') {
    return { reply: msg(messages, 'welcome', { businessName, categories: formatCategoryList(sorted) }), nextState: 'AWAITING_CATEGORY', cart: [], context: {}, placeOrder: false }
  }
  if (m === 'menu') {
    return { reply: msg(messages, 'menu_header', { categories: formatCategoryList(sorted) }), nextState: 'AWAITING_CATEGORY', cart: [], context: {}, placeOrder: false }
  }
  if (m === 'cart') {
    const cartStr = formatCart(cart, messages)
    const hint = cart.length > 0 ? '\n\n' + (messages['confirm_hint'] ?? '') : ''
    return { reply: cartStr + hint, nextState: state, cart, context, placeOrder: false }
  }
  if (m === 'cancel') {
    return { reply: messages['cancel'] ?? 'Order cancelled. Type *hi* to start a new order. 👋', nextState: 'IDLE', cart: [], context: {}, placeOrder: false }
  }

  switch (state) {
    case 'IDLE': {
      return { reply: msg(messages, 'welcome', { businessName, categories: formatCategoryList(sorted) }), nextState: 'AWAITING_CATEGORY', cart, context, placeOrder: false }
    }

    case 'AWAITING_CATEGORY': {
      const byNumber = parseInt(m, 10)
      let matched: Category | undefined
      if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= sorted.length) {
        matched = sorted[byNumber - 1]
      } else {
        matched = sorted.find((c) => c.name.toLowerCase() === m)
      }
      if (!matched) {
        return { reply: msg(messages, 'invalid_category', { categories: formatCategoryList(sorted) }), nextState: 'AWAITING_CATEGORY', cart, context, placeOrder: false }
      }
      if (matched.isCustom) {
        return { reply: messages['custom_prompt'] ?? "✏️ Tell us exactly what you'd like.", nextState: 'AWAITING_CUSTOM_DESCRIPTION', cart, context: { ...context, selectedCategoryId: matched.id }, placeOrder: false }
      }
      const items = menuItems.filter((i) => i.categoryId === matched!.id)
      return { reply: formatItems(items, matched.name, messages), nextState: 'AWAITING_ITEM', cart, context: { ...context, selectedCategoryId: matched.id }, placeOrder: false }
    }

    case 'AWAITING_ITEM': {
      if (m === 'back') {
        return { reply: msg(messages, 'back_to_categories', { categories: formatCategoryList(sorted) }), nextState: 'AWAITING_CATEGORY', cart, context: { ...context, selectedCategoryId: undefined }, placeOrder: false }
      }
      const catItems = menuItems.filter((i) => i.categoryId === context.selectedCategoryId).sort((a, b) => a.name.localeCompare(b.name))
      const byNumber = parseInt(m, 10)
      let matched: MenuItem | undefined
      if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= catItems.length) {
        matched = catItems[byNumber - 1]
      } else {
        matched = catItems.find((i) => i.name.toLowerCase().includes(m))
      }
      if (!matched) {
        const cat = categories.find((c) => c.id === context.selectedCategoryId)
        return { reply: (messages['invalid_item'] ?? 'Please choose a valid item.') + `\n\n` + formatItems(catItems, cat?.name ?? '', messages), nextState: 'AWAITING_ITEM', cart, context, placeOrder: false }
      }

      const fieldDefs = buildFieldDefs(matched.categoryId, matched.id, categoryFields)
      const newCtx = { ...context, selectedItemId: matched.id, selectedItemName: matched.name, selectedItemPrice: matched.price }

      if (fieldDefs.length > 0) {
        return {
          reply: formatFieldPrompt(fieldDefs[0], matched.name, matched.price, messages),
          nextState: 'AWAITING_FIELD',
          cart,
          context: { ...newCtx, pendingFields: fieldDefs, collectedFields: [] },
          placeOrder: false,
        }
      }

      return { reply: msg(messages, 'quantity_prompt', { item: matched.name }), nextState: 'AWAITING_QUANTITY', cart, context: newCtx, placeOrder: false }
    }

    case 'AWAITING_FIELD': {
      const pendingFields = context.pendingFields ?? []
      const collectedFields = context.collectedFields ?? []
      const currentIndex = collectedFields.length
      const currentField = pendingFields[currentIndex]

      if (!currentField) {
        return { reply: msg(messages, 'quantity_prompt', { item: context.selectedItemName ?? 'item' }), nextState: 'AWAITING_QUANTITY', cart, context, placeOrder: false }
      }

      let value: string | undefined
      let priceDelta = 0

      if (currentField.type === 'select') {
        const opts = currentField.options
        const byNumber = parseInt(m, 10)
        let picked: typeof opts[0] | undefined
        if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= opts.length) {
          picked = opts[byNumber - 1]
        } else {
          picked = opts.find(o => o.label.toLowerCase().includes(m))
        }
        if (!picked) {
          return {
            reply: (messages['invalid_field'] ?? 'Please choose a valid option.') + '\n\n' + formatFieldPrompt(currentField, context.selectedItemName!, context.selectedItemPrice!, messages),
            nextState: 'AWAITING_FIELD',
            cart,
            context,
            placeOrder: false,
          }
        }
        value = picked.label
        priceDelta = picked.priceDelta
      } else if (currentField.type === 'text') {
        if (m === 'skip' && !currentField.required) {
          value = ''
        } else if (message.trim().length === 0) {
          return { reply: formatFieldPrompt(currentField, context.selectedItemName!, context.selectedItemPrice!, messages), nextState: 'AWAITING_FIELD', cart, context, placeOrder: false }
        } else {
          value = message.trim()
        }
      } else if (currentField.type === 'number') {
        const n = parseInt(m, 10)
        if (isNaN(n) || n < 1) {
          return { reply: (messages['invalid_field'] ?? 'Please enter a valid number.') + '\n\n' + formatFieldPrompt(currentField, context.selectedItemName!, context.selectedItemPrice!, messages), nextState: 'AWAITING_FIELD', cart, context, placeOrder: false }
        }
        value = String(n)
      } else if (currentField.type === 'boolean') {
        if (['yes', 'y', '1'].includes(m)) value = 'yes'
        else if (['no', 'n', '0'].includes(m)) value = 'no'
        else return { reply: formatFieldPrompt(currentField, context.selectedItemName!, context.selectedItemPrice!, messages), nextState: 'AWAITING_FIELD', cart, context, placeOrder: false }
      }

      const newCollected: FieldSelection[] = [...collectedFields, { name: currentField.name, value: value!, priceDelta }]

      if (newCollected.length < pendingFields.length) {
        const nextField = pendingFields[newCollected.length]
        const accumulatedDelta = newCollected.reduce((s, f) => s + f.priceDelta, 0)
        const priceForPrompt = (context.selectedItemPrice ?? 0) + accumulatedDelta
        return {
          reply: formatFieldPrompt(nextField, context.selectedItemName!, priceForPrompt, messages),
          nextState: 'AWAITING_FIELD',
          cart,
          context: { ...context, collectedFields: newCollected },
          placeOrder: false,
        }
      }

      return {
        reply: msg(messages, 'quantity_prompt', { item: context.selectedItemName! }),
        nextState: 'AWAITING_QUANTITY',
        cart,
        context: { ...context, collectedFields: newCollected },
        placeOrder: false,
      }
    }

    case 'AWAITING_QUANTITY': {
      const qty = parseInt(m, 10)
      if (isNaN(qty) || qty < 1 || qty > 99) {
        return { reply: messages['invalid_quantity'] ?? 'Please enter a valid quantity (1–99).', nextState: 'AWAITING_QUANTITY', cart, context, placeOrder: false }
      }

      const collectedFields = context.collectedFields ?? []
      const fieldsKey = JSON.stringify(collectedFields.map(f => `${f.name}:${f.value}`))
      const existing = cart.findIndex(i =>
        i.menuItemId === context.selectedItemId &&
        JSON.stringify((i.fields ?? []).map(f => `${f.name}:${f.value}`)) === fieldsKey
      )

      let newCart: CartItem[]
      if (existing >= 0) {
        newCart = cart.map((item, idx) => idx === existing ? { ...item, quantity: item.quantity + qty } : item)
      } else {
        newCart = [...cart, {
          menuItemId: context.selectedItemId!,
          name: context.selectedItemName!,
          price: context.selectedItemPrice!,
          quantity: qty,
          fields: collectedFields,
        }]
      }

      const displayFields = collectedFields.filter(f => f.value).map(f => f.value).join(', ')
      const displayName = displayFields ? `${context.selectedItemName} (${displayFields})` : context.selectedItemName!

      return {
        reply: formatAfterAdd(newCart, sorted, displayName, qty, messages),
        nextState: 'AWAITING_MORE',
        cart: newCart,
        context: {
          ...context,
          selectedItemId: undefined,
          selectedItemName: undefined,
          selectedItemPrice: undefined,
          pendingFields: undefined,
          collectedFields: undefined,
        },
        placeOrder: false,
      }
    }

    case 'AWAITING_MORE': {
      if (m === 'confirm' || m === 'done' || m === 'checkout') {
        const cartTotal = cart.reduce((sum, i) => sum + itemTotal(i), 0)
        if (minOrderAmount > 0 && cartTotal < minOrderAmount) {
          return { reply: msg(messages, 'min_order', { amount: formatPrice(minOrderAmount) }) || `Minimum order is ${formatPrice(minOrderAmount)}.`, nextState: 'AWAITING_MORE', cart, context, placeOrder: false }
        }
        if (!deliveryDateEnabled) {
          return { reply: formatOrderSummary(cart, context, messages), nextState: 'AWAITING_CONFIRMATION', cart, context, placeOrder: false }
        }
        const datePrompt = deliveryDateLabel ?? (messages['delivery_date_prompt'] ?? "📅 When would you like your order?")
        return { reply: datePrompt, nextState: 'AWAITING_DELIVERY_DATE', cart, context, placeOrder: false }
      }

      const byNumber = parseInt(m, 10)
      let matched: Category | undefined
      if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= sorted.length) matched = sorted[byNumber - 1]
      else matched = sorted.find((c) => c.name.toLowerCase() === m)

      if (matched) {
        if (matched.isCustom) {
          return { reply: messages['custom_prompt'] ?? "✏️ Tell us exactly what you'd like.", nextState: 'AWAITING_CUSTOM_DESCRIPTION', cart, context: { ...context, selectedCategoryId: matched.id }, placeOrder: false }
        }
        const items = menuItems.filter((i) => i.categoryId === matched!.id)
        return { reply: formatItems(items, matched.name, messages), nextState: 'AWAITING_ITEM', cart, context: { ...context, selectedCategoryId: matched.id }, placeOrder: false }
      }

      return { reply: msg(messages, 'choose_more', { categories: formatCategoryList(sorted) }), nextState: 'AWAITING_MORE', cart, context, placeOrder: false }
    }

    case 'AWAITING_DELIVERY_DATE': {
      const dateInput = message.trim()
      if (dateInput.length < 2) {
        const datePrompt = deliveryDateLabel ?? (messages['delivery_date_prompt'] ?? "📅 When would you like your order?")
        return { reply: datePrompt, nextState: 'AWAITING_DELIVERY_DATE', cart, context, placeOrder: false }
      }
      const newContext = { ...context, deliveryNote: dateInput }
      return { reply: formatOrderSummary(cart, newContext, messages), nextState: 'AWAITING_CONFIRMATION', cart, context: newContext, placeOrder: false }
    }

    case 'AWAITING_CONFIRMATION': {
      if (m === 'yes' || m === 'confirm') {
        return {
          reply: messages['order_placed'] ?? '🎉 Order placed! We\'ll send you a payment link once confirmed.',
          nextState: 'ORDER_PENDING', cart, context: { ...context, paymentMethod: 'ONLINE' }, placeOrder: true,
        }
      }
      if (m === 'cancel' || m === 'no') {
        return { reply: messages['cancel'] ?? 'Order cancelled.', nextState: 'IDLE', cart: [], context: {}, placeOrder: false }
      }
      if (!context.appliedCode && discountCodes.length > 0) {
        const input = message.trim().toUpperCase()
        const code = discountCodes.find(c =>
          c.code.toUpperCase() === input &&
          (c.maxUses === 0 || c.usedCount < c.maxUses) &&
          (!c.expiresAt || new Date(c.expiresAt) > new Date())
        )
        if (code) {
          const cartTotal = cart.reduce((sum, i) => sum + itemTotal(i), 0)
          if (cartTotal < code.minAmount) {
            return { reply: msg(messages, 'discount_min_amount', { amount: formatPrice(code.minAmount) }), nextState: 'AWAITING_CONFIRMATION', cart, context, placeOrder: false }
          }
          const discountAmount = applyDiscount(code, cartTotal)
          const newContext = { ...context, appliedCode: code.code, appliedDiscount: discountAmount }
          return { reply: formatOrderSummary(cart, newContext, messages), nextState: 'AWAITING_CONFIRMATION', cart, context: newContext, placeOrder: false }
        }
        return { reply: msg(messages, 'invalid_code', {}) || "❌ That code isn't valid.", nextState: 'AWAITING_CONFIRMATION', cart, context, placeOrder: false }
      }
      return { reply: messages['await_confirm'] ?? 'Reply *yes* to confirm or *cancel* to start over.', nextState: 'AWAITING_CONFIRMATION', cart, context, placeOrder: false }
    }

    case 'AWAITING_PAYMENT_METHOD': {
      if (m === '1' || m === 'online' || m === 'pay online') {
        return { reply: messages['order_placed'] ?? '🎉 Order placed!', nextState: 'ORDER_PENDING', cart, context: { ...context, paymentMethod: 'ONLINE' }, placeOrder: true }
      }
      if (m === '2' || m === 'cod' || m === 'cash' || m === 'cash on delivery') {
        return { reply: messages['order_placed_cod'] ?? '🎉 Order placed! Payment on delivery.', nextState: 'ORDER_PENDING', cart, context: { ...context, paymentMethod: 'COD' }, placeOrder: true }
      }
      return { reply: messages['payment_method_prompt'] ?? `💳 *How would you like to pay?*\n\n1️⃣ Pay online\n2️⃣ Cash on delivery\n\nReply with *1* or *2*`, nextState: 'AWAITING_PAYMENT_METHOD', cart, context, placeOrder: false }
    }

    case 'AWAITING_CUSTOM_DESCRIPTION': {
      const desc = message.trim()
      if (desc.length < 10) {
        return { reply: messages['custom_too_short'] ?? 'Please give a bit more detail!', nextState: 'AWAITING_CUSTOM_DESCRIPTION', cart, context, placeOrder: false }
      }
      return {
        reply: msg(messages, 'custom_confirm', { description: desc }),
        nextState: 'AWAITING_CUSTOM_CONFIRM',
        cart,
        context: { ...context, customDescription: desc },
        placeOrder: false,
      }
    }

    case 'AWAITING_CUSTOM_CONFIRM': {
      if (m === 'yes' || m === 'confirm') {
        return { reply: messages['order_placed'] ?? '🎉 Order placed! We\'ll be in touch shortly.', nextState: 'ORDER_PENDING', cart, context: { ...context, paymentMethod: 'ONLINE' }, placeOrder: true }
      }
      if (m === 'edit') {
        return { reply: messages['custom_prompt'] ?? "✏️ Retype your request.", nextState: 'AWAITING_CUSTOM_DESCRIPTION', cart, context: { ...context, customDescription: undefined }, placeOrder: false }
      }
      return { reply: messages['custom_await_confirm'] ?? 'Reply *yes* to send, or *edit* to retype.', nextState: 'AWAITING_CUSTOM_CONFIRM', cart, context, placeOrder: false }
    }

    case 'ORDER_PENDING': {
      if (m === 'track') {
        return { reply: messages['order_pending'] ?? "Your order is being reviewed.", nextState: 'ORDER_PENDING', cart, context, placeOrder: false }
      }
      return { reply: messages['order_pending'] ?? "Your order is being reviewed. Type *hi* to start a new order.", nextState: 'ORDER_PENDING', cart, context, placeOrder: false }
    }

    default: {
      return { reply: msg(messages, 'welcome', { businessName, categories: formatCategoryList(sorted) }), nextState: 'AWAITING_CATEGORY', cart: [], context: {}, placeOrder: false }
    }
  }
}
