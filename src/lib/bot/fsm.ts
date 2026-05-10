import type { CartItem, BotContext } from '@/lib/botSession'

export type BotState =
  | 'IDLE'
  | 'AWAITING_CATEGORY'
  | 'AWAITING_ITEM'
  | 'AWAITING_QUANTITY'
  | 'AWAITING_MORE'
  | 'AWAITING_CONFIRMATION'
  | 'ORDER_PENDING'

export type Category = { id: string; name: string; sortOrder: number }
export type MenuItem = { id: string; name: string; price: number; categoryId: string; description?: string | null; imageUrl?: string | null; productUrl?: string | null }

export type BotInput = {
  message: string
  state: BotState
  cart: CartItem[]
  context: BotContext
  categories: Category[]
  menuItems: MenuItem[]
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

function formatWelcome(categories: Category[]): string {
  return (
    `👋 Welcome! What would you like to order today?\n\n` +
    formatCategoryList(categories) +
    `\n\nReply with a number to browse that category.`
  )
}

function formatItems(items: MenuItem[], categoryName: string): string {
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
    `\n\nReply with a number to select, or *back* to see all categories.`
  )
}

function formatCart(cart: CartItem[]): string {
  if (cart.length === 0) return 'Your cart is empty.'
  const lines = cart.map(
    (item) => `• ${item.name} × ${item.quantity} = ${formatPrice(item.price * item.quantity)}`
  )
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  return lines.join('\n') + `\n\n*Total: ${formatPrice(total)}*`
}

function formatAfterAdd(cart: CartItem[], categories: Category[], itemName: string, qty: number): string {
  return (
    `✅ Added ${qty}× *${itemName}* to your cart.\n\n` +
    formatCart(cart) +
    `\n\n───────────────\n` +
    `Add more? Choose a category:\n` +
    formatCategoryList(categories) +
    `\n\nOr type *confirm* to place your order.`
  )
}

export function processMessage(input: BotInput): BotOutput {
  const { message, state, cart, context, categories, menuItems } = input
  const msg = message.trim().toLowerCase()
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  // Global commands
  if (msg === 'hi' || msg === 'hello' || msg === 'start') {
    return {
      reply: formatWelcome(categories),
      nextState: 'AWAITING_CATEGORY',
      cart: [],
      context: {},
      placeOrder: false,
    }
  }

  if (msg === 'menu') {
    return {
      reply: `*Our Menu*\n\n` + formatCategoryList(categories) + `\n\nReply with a number to browse.`,
      nextState: 'AWAITING_CATEGORY',
      cart: [],
      context: {},
      placeOrder: false,
    }
  }

  if (msg === 'cart') {
    return {
      reply:
        formatCart(cart) +
        (cart.length > 0 ? '\n\nType *confirm* to place order or *cancel* to start over.' : ''),
      nextState: state,
      cart,
      context,
      placeOrder: false,
    }
  }

  if (msg === 'cancel') {
    return {
      reply: 'Order cancelled. Type *hi* to start a new order. 👋',
      nextState: 'IDLE',
      cart: [],
      context: {},
      placeOrder: false,
    }
  }

  switch (state) {
    case 'IDLE': {
      return {
        reply: formatWelcome(categories),
        nextState: 'AWAITING_CATEGORY',
        cart,
        context,
        placeOrder: false,
      }
    }

    case 'AWAITING_CATEGORY': {
      const byNumber = parseInt(msg, 10)
      let matched: Category | undefined

      if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= sorted.length) {
        matched = sorted[byNumber - 1]
      } else {
        matched = sorted.find((c) => c.name.toLowerCase() === msg)
      }

      if (!matched) {
        return {
          reply:
            `Hmm, I didn't catch that. Please choose a category:\n\n` +
            formatCategoryList(sorted) +
            `\n\nReply with a number.`,
          nextState: 'AWAITING_CATEGORY',
          cart,
          context,
          placeOrder: false,
        }
      }

      const items = menuItems.filter((i) => i.categoryId === matched!.id)
      return {
        reply: formatItems(items, matched.name),
        nextState: 'AWAITING_ITEM',
        cart,
        context: { ...context, selectedCategoryId: matched.id },
        placeOrder: false,
      }
    }

    case 'AWAITING_ITEM': {
      if (msg === 'back') {
        return {
          reply:
            `Choose a category:\n\n` + formatCategoryList(sorted) + `\n\nReply with a number.`,
          nextState: 'AWAITING_CATEGORY',
          cart,
          context: { ...context, selectedCategoryId: undefined },
          placeOrder: false,
        }
      }

      const catItems = menuItems
        .filter((i) => i.categoryId === context.selectedCategoryId)
        .sort((a, b) => a.name.localeCompare(b.name))
      const byNumber = parseInt(msg, 10)
      let matched: MenuItem | undefined

      if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= catItems.length) {
        matched = catItems[byNumber - 1]
      } else {
        matched = catItems.find((i) => i.name.toLowerCase().includes(msg))
      }

      if (!matched) {
        const cat = categories.find((c) => c.id === context.selectedCategoryId)
        return {
          reply: `Please choose a valid item.\n\n` + formatItems(catItems, cat?.name ?? ''),
          nextState: 'AWAITING_ITEM',
          cart,
          context,
          placeOrder: false,
        }
      }

      return {
        reply: `How many *${matched.name}* would you like?`,
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
      const qty = parseInt(msg, 10)
      if (isNaN(qty) || qty < 1 || qty > 99) {
        return {
          reply: 'Please enter a valid quantity (1–99).',
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
        reply: formatAfterAdd(newCart, sorted, context.selectedItemName!, qty),
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
      if (msg === 'confirm' || msg === 'done' || msg === 'checkout') {
        return {
          reply:
            `🧾 *Order Summary*\n\n` +
            formatCart(cart) +
            `\n\nReply *yes* to confirm and place your order, or *cancel* to start over.`,
          nextState: 'AWAITING_CONFIRMATION',
          cart,
          context,
          placeOrder: false,
        }
      }

      // Try to pick a category to add more items
      const byNumber = parseInt(msg, 10)
      let matched: Category | undefined
      if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= sorted.length) {
        matched = sorted[byNumber - 1]
      } else {
        matched = sorted.find((c) => c.name.toLowerCase() === msg)
      }

      if (matched) {
        const items = menuItems.filter((i) => i.categoryId === matched!.id)
        return {
          reply: formatItems(items, matched.name),
          nextState: 'AWAITING_ITEM',
          cart,
          context: { ...context, selectedCategoryId: matched.id },
          placeOrder: false,
        }
      }

      return {
        reply:
          `Choose a category to add more:\n\n` +
          formatCategoryList(sorted) +
          `\n\nOr type *confirm* to place your order.`,
        nextState: 'AWAITING_MORE',
        cart,
        context,
        placeOrder: false,
      }
    }

    case 'AWAITING_CONFIRMATION': {
      if (msg === 'yes' || msg === 'confirm') {
        return {
          reply:
            `🎉 Order placed! The baker will review it and get back to you shortly.\n\nThank you for ordering with us! 🍰`,
          nextState: 'ORDER_PENDING',
          cart,
          context,
          placeOrder: true,
        }
      }
      if (msg === 'cancel' || msg === 'no') {
        return {
          reply: 'Order cancelled. Type *hi* to start a new order. 👋',
          nextState: 'IDLE',
          cart: [],
          context: {},
          placeOrder: false,
        }
      }
      return {
        reply: `Reply *yes* to confirm your order or *cancel* to start over.`,
        nextState: 'AWAITING_CONFIRMATION',
        cart,
        context,
        placeOrder: false,
      }
    }

    case 'ORDER_PENDING': {
      return {
        reply:
          `Your order is being reviewed by the baker. We'll notify you once it's accepted. 🕐\n\nType *hi* to start a new order.`,
        nextState: 'ORDER_PENDING',
        cart,
        context,
        placeOrder: false,
      }
    }

    default: {
      return {
        reply: formatWelcome(categories),
        nextState: 'AWAITING_CATEGORY',
        cart: [],
        context: {},
        placeOrder: false,
      }
    }
  }
}
