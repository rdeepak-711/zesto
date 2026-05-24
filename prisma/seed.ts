export function defaultBotMessages(tenantId: string) {
  return [
    { key: 'welcome', tenantId, label: 'Welcome greeting', value: "👋 Welcome to {businessName}!\n\nWhat would you like today?\n\n{categories}\n\nReply with a number to browse and order.\n\n📦 Type *track* to check your order status\n❌ Type *cancel order* to cancel" },
    { key: 'order_placed', tenantId, label: 'Order placed', value: "🎉 Order placed! The team will review it and get back to you shortly.\n\nType *track* to check your order status anytime. Thank you!" },
    { key: 'closed_message', tenantId, label: 'Outside business hours', value: "😴 We're closed right now!\n\nWe're open {openDays}, {openTime}–{closeTime}.\n\nSend us a message then and we'll be happy to help! 🙏" },
    { key: 'social_footer', tenantId, label: 'Social links / sign-off', value: "" },
    { key: 'order_placed_cod', tenantId, label: 'Order placed (COD)', value: "🎉 Order placed! Payment will be collected on delivery. The team will confirm shortly." },
    { key: 'custom_prompt', tenantId, label: 'Custom order prompt', value: "✏️ Tell us exactly what you'd like — include all relevant details. Be as specific as possible!" },
    { key: 'menu_header', tenantId, label: 'Menu command reply', value: '*Our Menu*\n\n{categories}\n\nReply with a number to browse.' },
    { key: 'invalid_category', tenantId, label: 'Invalid category', value: "Hmm, I didn't catch that. Please choose a category:\n\n{categories}\n\nReply with a number." },
    { key: 'items_footer', tenantId, label: 'Item list footer', value: 'Reply with a number to select, or *back* to see all categories.' },
    { key: 'invalid_item', tenantId, label: 'Invalid item', value: 'Please choose a valid item.' },
    { key: 'quantity_prompt', tenantId, label: 'Quantity prompt', value: 'How many *{item}* would you like?' },
    { key: 'invalid_quantity', tenantId, label: 'Invalid quantity', value: 'Please enter a valid quantity (1–99).' },
    { key: 'item_added', tenantId, label: 'Item added to cart', value: '✅ Added {qty}× *{item}* to your cart.' },
    { key: 'add_more_prompt', tenantId, label: 'Add more prompt', value: 'Add more? Choose a category:\n\n{categories}\n\nOr type *confirm* to place your order.' },
    { key: 'order_summary', tenantId, label: 'Order summary', value: '🧾 *Order Summary*\n\n{cart}\n\nReply *yes* to confirm, or *cancel* to start over.' },
    { key: 'order_pending', tenantId, label: 'Order already pending', value: "Your order is being reviewed. We'll notify you once it's accepted. 🕐\n\nType *hi* to start a new order." },
    { key: 'cancel', tenantId, label: 'Order cancelled', value: 'Order cancelled. Type *hi* to start a new order. 👋' },
    { key: 'cart_empty', tenantId, label: 'Cart empty', value: 'Your cart is empty.' },
    { key: 'confirm_hint', tenantId, label: 'Confirm hint', value: 'Type *confirm* to place order or *cancel* to start over.' },
    { key: 'await_confirm', tenantId, label: 'Awaiting confirm', value: 'Reply *yes* to confirm your order or *cancel* to start over.' },
    { key: 'back_to_categories', tenantId, label: 'Back to categories', value: 'Choose a category:\n\n{categories}\n\nReply with a number.' },
    { key: 'custom_confirm', tenantId, label: 'Custom order confirm', value: "Got it! Here's your request:\n\n_{description}_\n\nPrice will be confirmed by the team.\n\nReply *yes* to send, or *edit* to retype." },
    { key: 'custom_too_short', tenantId, label: 'Custom order too short', value: 'Please give a bit more detail so the team knows exactly what to make!' },
    { key: 'custom_await_confirm', tenantId, label: 'Custom order awaiting yes', value: 'Reply *yes* to send, or *edit* to retype your request.' },
    { key: 'field_prompt_footer', tenantId, label: 'Field selection footer', value: 'Reply with a number to select.' },
    { key: 'invalid_field', tenantId, label: 'Invalid field input', value: 'Please choose a valid option.' },
    { key: 'delivery_date_prompt', tenantId, label: 'Delivery date prompt', value: "📅 When would you like your order? (e.g. *Tomorrow 3pm*, *Friday*, *ASAP*)" },
    { key: 'discount_hint', tenantId, label: 'Discount hint', value: 'Have a discount code? Type it now, or type *yes* to confirm.' },
    { key: 'discount_min_amount', tenantId, label: 'Discount min amount error', value: 'This code requires a minimum order of {amount}.' },
    { key: 'invalid_code', tenantId, label: 'Invalid discount code', value: "❌ That code isn't valid. Type *yes* to confirm or *cancel* to start over." },
    { key: 'min_order', tenantId, label: 'Minimum order not met', value: 'Minimum order is {amount}. Please add more items to continue.' },
    { key: 'payment_method_prompt', tenantId, label: 'Payment method prompt', value: "💳 *How would you like to pay?*\n\n1️⃣ Pay online (UPI / Card / Netbanking)\n2️⃣ Cash on delivery\n\nReply with *1* or *2*" },
    { key: 'track_no_order', tenantId, label: 'Track — no order', value: "You don't have any active orders. Type *hi* to start a new order! 🛍️" },
    { key: 'cancel_no_order', tenantId, label: 'Cancel — no order', value: 'No active order found to cancel. Type *hi* to start a new order.' },
    { key: 'cancel_confirmed', tenantId, label: 'Cancel confirmed', value: '✅ Your order has been cancelled. Type *hi* to start a new order.' },
    { key: 'cancel_request_sent', tenantId, label: 'Cancel request sent', value: "Your cancellation request has been sent. We'll confirm shortly." },
    { key: 'choose_more', tenantId, label: 'Choose more items', value: 'Add more? Choose a category:\n\n{categories}\n\nOr type *confirm* to place your order.' },
    { key: 'custom_order_placed', tenantId, label: 'Custom order sent to baker', value: "🎉 Sent! Our baker will review your request and get back to you with a quote and availability. We'll WhatsApp you shortly." },
    { key: 'custom_edit_restart', tenantId, label: 'Custom order edit restart prompt', value: "🎂 Let's start over! What's the occasion?\n\n1️⃣ Birthday\n2️⃣ Wedding\n3️⃣ Anniversary\n4️⃣ Corporate / Office\n5️⃣ Other" },
  ]
}

async function main() {
  console.log('seed.ts: no direct DB writes — use bootstrapTenant.ts instead')
}

if (require.main === module) {
  main().catch(console.error)
}
