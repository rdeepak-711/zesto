import type { CartItem, BotContext } from '@/lib/botSession'

export type BotState =
  | 'IDLE'
  | 'AWAITING_CATEGORY'
  | 'AWAITING_ITEM'
  | 'AWAITING_QUANTITY'
  | 'AWAITING_MORE'
  | 'AWAITING_CONFIRMATION'
  | 'AWAITING_CUSTOM_DESCRIPTION'
  | 'AWAITING_CUSTOM_CONFIRM'
  | 'ORDER_PENDING'

export type Category = { id: string; name: string; sortOrder: number; isCustom: boolean }
export type MenuItem = { id: string; name: string; price: number; categoryId: string; description?: string | null; imageUrl?: string | null; productUrl?: string | null }

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
  rules?: BotRule[]
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
    const link = item.productUrl
      ? `\n   ${item.productUrl}`
      : item.imageUrl
        ? `\n   ${item.imageUrl}`
        : ''
    return `${i + 1}. *${item.name}* — ${formatPrice(item.price)}${desc}${link}`
  })
  return (
    `*${categoryName}*\n\n` +
    lines.join('\n\n') +
    `\n\n` +
    (messages['items_footer'] ?? 'Reply with a number to select, or *back* to see all categories.')
  )
}

function formatCart(cart: CartItem[], messages: BotMessages): string {
  if (cart.length === 0) return messages['cart_empty'] ?? 'Your cart is empty.'
  const lines = cart.map(
    (item) => `• ${item.name} × ${item.quantity} = ${formatPrice(item.price * item.quantity)}`
  )
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  return lines.join('\n') + `\n\n*Total: ${formatPrice(total)}*`
}

function formatAfterAdd(cart: CartItem[], categories: Category[], itemName: string, qty: number, messages: BotMessages): string {
  const cartStr = formatCart(cart, messages)
  const added = msg(messages, 'item_added', { item: itemName, qty: String(qty) })
  const more = msg(messages, 'add_more_prompt', { categories: formatCategoryList(categories) })
  return `${added}\n\n${cartStr}\n\n───────────────\n${more}`
}

function matchesRule(rule: BotRule, msg: string, state: BotState): boolean {
  const m = msg.trim().toLowerCase()
  const text = rule.matchText.toLowerCase()
  if (rule.state !== '*' && rule.state !== state) return false
  if (rule.condition === 'equals') return m === text
  if (rule.condition === 'contains') return m.includes(text)
  if (rule.condition === 'starts_with') return m.startsWith(text)
  return false
}

export function processMessage(input: BotInput): BotOutput {
  const { message, state, cart, context, categories, menuItems, messages, rules = [] } = input
  const m = message.trim().toLowerCase()
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  // Custom rules — checked before all built-in logic
  for (const rule of rules) {
    if (!rule.active) continue
    if (matchesRule(rule, message, state)) {
      const nextState = rule.nextState === 'SAME' ? state : (rule.nextState as BotState)
      return { reply: rule.reply, nextState, cart, context, placeOrder: false }
    }
  }

  // Global commands
  if (m === 'hi' || m === 'hello' || m === 'start') {
    return {
      reply: msg(messages, 'welcome', { categories: formatCategoryList(sorted) }),
      nextState: 'AWAITING_CATEGORY',
      cart: [],
      context: {},
      placeOrder: false,
    }
  }

  if (m === 'menu') {
    return {
      reply: msg(messages, 'menu_header', { categories: formatCategoryList(sorted) }),
      nextState: 'AWAITING_CATEGORY',
      cart: [],
      context: {},
      placeOrder: false,
    }
  }

  if (m === 'cart') {
    const cartStr = formatCart(cart, messages)
    const hint = cart.length > 0 ? '\n\n' + (messages['confirm_hint'] ?? '') : ''
    return {
      reply: cartStr + hint,
      nextState: state,
      cart,
      context,
      placeOrder: false,
    }
  }

  if (m === 'cancel') {
    return {
      reply: messages['cancel'] ?? 'Order cancelled. Type *hi* to start a new order. 👋',
      nextState: 'IDLE',
      cart: [],
      context: {},
      placeOrder: false,
    }
  }

  switch (state) {
    case 'IDLE': {
      return {
        reply: msg(messages, 'welcome', { categories: formatCategoryList(sorted) }),
        nextState: 'AWAITING_CATEGORY',
        cart,
        context,
        placeOrder: false,
      }
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
        return {
          reply: msg(messages, 'invalid_category', { categories: formatCategoryList(sorted) }),
          nextState: 'AWAITING_CATEGORY',
          cart,
          context,
          placeOrder: false,
        }
      }

      if (matched.isCustom) {
        return {
          reply: messages['custom_prompt'] ?? '✏️ Tell us exactly what you\'d like — flavor, size, quantity, occasion, any special requirements. Be as specific as possible!',
          nextState: 'AWAITING_CUSTOM_DESCRIPTION',
          cart,
          context: { ...context, selectedCategoryId: matched.id },
          placeOrder: false,
        }
      }

      const items = menuItems.filter((i) => i.categoryId === matched!.id)
      return {
        reply: formatItems(items, matched.name, messages),
        nextState: 'AWAITING_ITEM',
        cart,
        context: { ...context, selectedCategoryId: matched.id },
        placeOrder: false,
      }
    }

    case 'AWAITING_ITEM': {
      if (m === 'back') {
        return {
          reply: msg(messages, 'back_to_categories', { categories: formatCategoryList(sorted) }),
          nextState: 'AWAITING_CATEGORY',
          cart,
          context: { ...context, selectedCategoryId: undefined },
          placeOrder: false,
        }
      }

      const catItems = menuItems
        .filter((i) => i.categoryId === context.selectedCategoryId)
        .sort((a, b) => a.name.localeCompare(b.name))
      const byNumber = parseInt(m, 10)
      let matched: MenuItem | undefined

      if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= catItems.length) {
        matched = catItems[byNumber - 1]
      } else {
        matched = catItems.find((i) => i.name.toLowerCase().includes(m))
      }

      if (!matched) {
        const cat = categories.find((c) => c.id === context.selectedCategoryId)
        return {
          reply: (messages['invalid_item'] ?? 'Please choose a valid item.') + `\n\n` + formatItems(catItems, cat?.name ?? '', messages),
          nextState: 'AWAITING_ITEM',
          cart,
          context,
          placeOrder: false,
        }
      }

      return {
        reply: msg(messages, 'quantity_prompt', { item: matched.name }),
        nextState: 'AWAITING_QUANTITY',
        cart,
        context: {
          ...context,
          selectedItemId: matched.id,
          selectedItemName: matched.name,
          selectedItemPrice: matched.price,
        },
        placeOrder: false,
      }
    }

    case 'AWAITING_QUANTITY': {
      const qty = parseInt(m, 10)
      if (isNaN(qty) || qty < 1 || qty > 99) {
        return {
          reply: messages['invalid_quantity'] ?? 'Please enter a valid quantity (1–99).',
          nextState: 'AWAITING_QUANTITY',
          cart,
          context,
          placeOrder: false,
        }
      }

      const existing = cart.findIndex((i) => i.menuItemId === context.selectedItemId)
      let newCart: CartItem[]
      if (existing >= 0) {
        newCart = cart.map((item, idx) =>
          idx === existing ? { ...item, quantity: item.quantity + qty } : item
        )
      } else {
        newCart = [
          ...cart,
          {
            menuItemId: context.selectedItemId!,
            name: context.selectedItemName!,
            price: context.selectedItemPrice!,
            quantity: qty,
          },
        ]
      }

      return {
        reply: formatAfterAdd(newCart, sorted, context.selectedItemName!, qty, messages),
        nextState: 'AWAITING_MORE',
        cart: newCart,
        context: {
          ...context,
          selectedItemId: undefined,
          selectedItemName: undefined,
          selectedItemPrice: undefined,
        },
        placeOrder: false,
      }
    }

    case 'AWAITING_MORE': {
      if (m === 'confirm' || m === 'done' || m === 'checkout') {
        const cartStr = formatCart(cart, messages)
        return {
          reply: msg(messages, 'order_summary', { cart: cartStr }),
          nextState: 'AWAITING_CONFIRMATION',
          cart,
          context,
          placeOrder: false,
        }
      }

      const byNumber = parseInt(m, 10)
      let matched: Category | undefined
      if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= sorted.length) {
        matched = sorted[byNumber - 1]
      } else {
        matched = sorted.find((c) => c.name.toLowerCase() === m)
      }

      if (matched) {
        const items = menuItems.filter((i) => i.categoryId === matched!.id)
        return {
          reply: formatItems(items, matched.name, messages),
          nextState: 'AWAITING_ITEM',
          cart,
          context: { ...context, selectedCategoryId: matched.id },
          placeOrder: false,
        }
      }

      return {
        reply: msg(messages, 'choose_more', { categories: formatCategoryList(sorted) }),
        nextState: 'AWAITING_MORE',
        cart,
        context,
        placeOrder: false,
      }
    }

    case 'AWAITING_CONFIRMATION': {
      if (m === 'yes' || m === 'confirm') {
        return {
          reply: messages['order_placed'] ?? '🎉 Order placed! The baker will review it and get back to you shortly.',
          nextState: 'ORDER_PENDING',
          cart,
          context,
          placeOrder: true,
        }
      }
      if (m === 'cancel' || m === 'no') {
        return {
          reply: messages['cancel'] ?? 'Order cancelled. Type *hi* to start a new order. 👋',
          nextState: 'IDLE',
          cart: [],
          context: {},
          placeOrder: false,
        }
      }
      return {
        reply: messages['await_confirm'] ?? 'Reply *yes* to confirm your order or *cancel* to start over.',
        nextState: 'AWAITING_CONFIRMATION',
        cart,
        context,
        placeOrder: false,
      }
    }

    case 'AWAITING_CUSTOM_DESCRIPTION': {
      const desc = message.trim()
      if (desc.length < 5) {
        return {
          reply: messages['custom_too_short'] ?? 'Please give a bit more detail so the baker knows exactly what to make!',
          nextState: 'AWAITING_CUSTOM_DESCRIPTION',
          cart,
          context,
          placeOrder: false,
        }
      }
      const summary = msg(messages, 'custom_confirm', { description: desc })
      return {
        reply: summary,
        nextState: 'AWAITING_CUSTOM_CONFIRM',
        cart,
        context: { ...context, customDescription: desc },
        placeOrder: false,
      }
    }

    case 'AWAITING_CUSTOM_CONFIRM': {
      if (m === 'yes' || m === 'confirm') {
        return {
          reply: messages['order_placed'] ?? '🎉 Custom order sent! The baker will review and confirm the price shortly.',
          nextState: 'ORDER_PENDING',
          cart,
          context,
          placeOrder: true,
        }
      }
      if (m === 'edit' || m === 'no' || m === 'cancel') {
        return {
          reply: messages['custom_prompt'] ?? '✏️ Tell us exactly what you\'d like — flavor, size, quantity, occasion, any special requirements.',
          nextState: 'AWAITING_CUSTOM_DESCRIPTION',
          cart,
          context: { ...context, customDescription: undefined },
          placeOrder: false,
        }
      }
      return {
        reply: messages['custom_await_confirm'] ?? 'Reply *yes* to send to the baker, or *edit* to retype your request.',
        nextState: 'AWAITING_CUSTOM_CONFIRM',
        cart,
        context,
        placeOrder: false,
      }
    }

    case 'ORDER_PENDING': {
      return {
        reply: messages['order_pending'] ?? "Your order is being reviewed by the baker. We'll notify you once it's accepted.",
        nextState: 'ORDER_PENDING',
        cart,
        context,
        placeOrder: false,
      }
    }

    default: {
      return {
        reply: msg(messages, 'welcome', { categories: formatCategoryList(sorted) }),
        nextState: 'AWAITING_CATEGORY',
        cart: [],
        context: {},
        placeOrder: false,
      }
    }
  }
}
