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
export type MenuItem = { id: string; name: string; price: number; categoryId: string }

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
  return `₹${(paise / 100).toFixed(2)}`
}

function formatMenu(categories: Category[], menuItems: MenuItem[]): string {
  const lines: string[] = ['*Our Menu:*\n']
  for (const cat of [...categories].sort((a, b) => a.sortOrder - b.sortOrder)) {
    lines.push(`*${cat.name}*`)
    const items = menuItems
      .filter((i) => i.categoryId === cat.id)
      .sort((a, b) => a.name.localeCompare(b.name))
    items.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.name} — ${formatPrice(item.price)}`)
    })
    lines.push('')
  }
  lines.push('Reply with the category name to browse items.')
  return lines.join('\n')
}

function formatCategories(categories: Category[]): string {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  return (
    '*Choose a category:*\n' +
    sorted.map((c, i) => `${i + 1}. ${c.name}`).join('\n') +
    '\n\nReply with the number or name.'
  )
}

function formatItems(items: MenuItem[], categoryName: string): string {
  return (
    `*${categoryName} items:*\n` +
    items.map((item, i) => `${i + 1}. ${item.name} — ${formatPrice(item.price)}`).join('\n') +
    '\n\nReply with the number to add to cart.'
  )
}

function formatCart(cart: CartItem[]): string {
  if (cart.length === 0) return 'Your cart is empty.'
  const lines = cart.map(
    (item) => `• ${item.name} × ${item.quantity} = ${formatPrice(item.price * item.quantity)}`
  )
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  lines.push(`\n*Total: ${formatPrice(total)}*`)
  return lines.join('\n')
}

export function processMessage(input: BotInput): BotOutput {
  const { message, state, cart, context, categories, menuItems } = input
  const msg = message.trim().toLowerCase()

  // Global commands available in any state
  if (msg === 'menu' || msg === 'start' || msg === 'hi' || msg === 'hello') {
    return {
      reply: formatMenu(categories, menuItems),
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
        (cart.length > 0 ? '\n\nReply *confirm* to place order or *menu* to keep browsing.' : ''),
      nextState: state,
      cart,
      context,
      placeOrder: false,
    }
  }

  if (msg === 'cancel') {
    return {
      reply: 'Order cancelled. Type *menu* to start over.',
      nextState: 'IDLE',
      cart: [],
      context: {},
      placeOrder: false,
    }
  }

  switch (state) {
    case 'IDLE': {
      return {
        reply: 'Hi! Type *menu* to see our menu or *hi* to get started.',
        nextState: 'IDLE',
        cart,
        context,
        placeOrder: false,
      }
    }

    case 'AWAITING_CATEGORY': {
      const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
      const byNumber = parseInt(msg, 10)
      let matched: Category | undefined

      if (!isNaN(byNumber) && byNumber >= 1 && byNumber <= sorted.length) {
        matched = sorted[byNumber - 1]
      } else {
        matched = sorted.find((c) => c.name.toLowerCase() === msg)
      }

      if (!matched) {
        return {
          reply: 'Please choose a valid category.\n\n' + formatCategories(sorted),
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
      const catItems = menuItems.filter((i) => i.categoryId === context.selectedCategoryId)
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
          reply: 'Please choose a valid item.\n\n' + formatItems(catItems, cat?.name ?? ''),
          nextState: 'AWAITING_ITEM',
          cart,
          context,
          placeOrder: false,
        }
      }

      return {
        reply: `How many *${matched.name}* would you like? (enter a number)`,
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
        reply:
          `Added ${qty}× ${context.selectedItemName} to cart.\n\n` +
          formatCart(newCart) +
          '\n\nWould you like to add more items? Reply *yes* to browse or *confirm* to place order.',
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
      if (msg === 'yes' || msg === 'more' || msg === 'add more') {
        return {
          reply: formatCategories(categories),
          nextState: 'AWAITING_CATEGORY',
          cart,
          context: { ...context, selectedCategoryId: undefined },
          placeOrder: false,
        }
      }
      if (msg === 'confirm' || msg === 'done' || msg === 'order') {
        return {
          reply:
            formatCart(cart) +
            '\n\nPlease confirm your order by replying *confirm* or *cancel* to start over.',
          nextState: 'AWAITING_CONFIRMATION',
          cart,
          context,
          placeOrder: false,
        }
      }
      return {
        reply: 'Reply *yes* to add more items or *confirm* to place your order.',
        nextState: 'AWAITING_MORE',
        cart,
        context,
        placeOrder: false,
      }
    }

    case 'AWAITING_CONFIRMATION': {
      if (msg === 'confirm' || msg === 'yes') {
        return {
          reply:
            'Order placed! 🎉 The baker will review and accept your order shortly. You\'ll receive payment instructions once accepted.',
          nextState: 'ORDER_PENDING',
          cart,
          context,
          placeOrder: true,
        }
      }
      if (msg === 'cancel' || msg === 'no') {
        return {
          reply: 'Order cancelled. Type *menu* to start over.',
          nextState: 'IDLE',
          cart: [],
          context: {},
          placeOrder: false,
        }
      }
      return {
        reply: 'Reply *confirm* to place your order or *cancel* to start over.',
        nextState: 'AWAITING_CONFIRMATION',
        cart,
        context,
        placeOrder: false,
      }
    }

    case 'ORDER_PENDING': {
      return {
        reply:
          'Your order is being processed. The baker will notify you soon.\nType *menu* to start a new order.',
        nextState: 'ORDER_PENDING',
        cart,
        context,
        placeOrder: false,
      }
    }

    default: {
      return {
        reply: 'Type *menu* to get started.',
        nextState: 'IDLE',
        cart: [],
        context: {},
        placeOrder: false,
      }
    }
  }
}
