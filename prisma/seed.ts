import { PrismaClient } from '@prisma/client'
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'

const adapter = new PrismaTiDBCloud({ url: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  await db.bakeryConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      bakeryName: 'Sweet Crumbs Bakery',
      bakerPhone: process.env.BAKER_PHONE ?? '+910000000000',
      whatsappNumber:
        process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '') ?? '+910000000000',
      address: '12, MG Road, Bangalore 560001',
      welcomeMessage: 'Hi! Welcome to Sweet Crumbs 🎂\nType *menu* anytime to start over.',
    },
  })

  // Sentinel category + item for custom orders — never shown to customers
  const customCat = await db.menuCategory.upsert({
    where: { id: 'cat-custom' },
    update: {},
    create: { id: 'cat-custom', name: 'Custom', sortOrder: 99, isCustom: true, active: false },
  })
  await db.menuItem.upsert({
    where: { id: 'item-custom' },
    update: {},
    create: { id: 'item-custom', categoryId: customCat.id, name: 'Custom Order', price: 0, sortOrder: 0, available: false },
  })

  const cakes = await db.menuCategory.upsert({
    where: { id: 'cat-cakes' },
    update: {},
    create: { id: 'cat-cakes', name: 'Cakes', sortOrder: 1 },
  })

  const pastries = await db.menuCategory.upsert({
    where: { id: 'cat-pastries' },
    update: {},
    create: { id: 'cat-pastries', name: 'Pastries', sortOrder: 2 },
  })

  const cookies = await db.menuCategory.upsert({
    where: { id: 'cat-cookies' },
    update: {},
    create: { id: 'cat-cookies', name: 'Cookies', sortOrder: 3 },
  })

  const items = [
    { id: 'item-choc-cake', categoryId: cakes.id, name: 'Chocolate Fudge Cake (1kg)', price: 80000, sortOrder: 1, description: 'Rich dark chocolate layers with ganache frosting', imageUrl: 'https://images.unsplash.com/photo-1565808229224-264b6fcc5052?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NDc1NzZ8MHwxfHNlYXJjaHwxfHxjaG9jb2xhdGUlMjBmdWRnZSUyMGNha2V8ZW58MHwyfHx8MTc3ODQyNDQ5NHww&ixlib=rb-4.1.0&q=80&w=1080' },
    { id: 'item-vanilla-cake', categoryId: cakes.id, name: 'Vanilla Dream Cake (1kg)', price: 70000, sortOrder: 2, description: 'Light vanilla sponge with whipped cream and fresh berries', imageUrl: 'https://images.unsplash.com/photo-1574043436847-6e18093727c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NDc1NzZ8MHwxfHNlYXJjaHwxfHx2YW5pbGxhJTIwY3JlYW0lMjBjYWtlfGVufDB8Mnx8fDE3Nzg0MjQ0OTV8MA&ixlib=rb-4.1.0&q=80&w=1080' },
    { id: 'item-red-velvet', categoryId: cakes.id, name: 'Red Velvet Cake (1kg)', price: 90000, sortOrder: 3, description: 'Classic red velvet with cream cheese frosting', imageUrl: 'https://images.unsplash.com/photo-1635117492718-695a17a5977a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NDc1NzZ8MHwxfHNlYXJjaHwxfHxyZWQlMjB2ZWx2ZXQlMjBjYWtlfGVufDB8Mnx8fDE3Nzg0MjQ0OTV8MA&ixlib=rb-4.1.0&q=80&w=1080' },
    { id: 'item-croissant', categoryId: pastries.id, name: 'Butter Croissant', price: 8000, sortOrder: 1, description: 'Flaky, buttery layers baked fresh every morning', imageUrl: 'https://images.unsplash.com/photo-1691480162735-9b91238080f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NDc1NzZ8MHwxfHNlYXJjaHwxfHxidXR0ZXIlMjBjcm9pc3NhbnR8ZW58MHwyfHx8MTc3ODQyNDQ5Nnww&ixlib=rb-4.1.0&q=80&w=1080' },
    { id: 'item-eclair', categoryId: pastries.id, name: 'Chocolate Éclair', price: 10000, sortOrder: 2, description: 'Choux pastry filled with vanilla cream, topped with chocolate glaze', imageUrl: 'https://images.unsplash.com/photo-1535229573109-d04520917965?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NDc1NzZ8MHwxfHNlYXJjaHwxfHxjaG9jb2xhdGUlMjBlY2xhaXJ8ZW58MHwyfHx8MTc3ODQyNDQ5Nnww&ixlib=rb-4.1.0&q=80&w=1080' },
    { id: 'item-danish', categoryId: pastries.id, name: 'Fruit Danish', price: 9000, sortOrder: 3, description: 'Buttery pastry with seasonal fruit and cream cheese filling', imageUrl: 'https://images.unsplash.com/photo-1731406169646-9661105c5d85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NDc1NzZ8MHwxfHNlYXJjaHwxfHxmcnVpdCUyMGRhbmlzaCUyMHBhc3RyeXxlbnwwfDJ8fHwxNzc4NDI0NDk3fDA&ixlib=rb-4.1.0&q=80&w=1080' },
    { id: 'item-choc-chip', categoryId: cookies.id, name: 'Choc Chip Cookies (6 pcs)', price: 25000, sortOrder: 1, description: 'Soft-baked with generous chunks of dark chocolate', imageUrl: 'https://images.unsplash.com/photo-1629677594742-58acc2c5ca82?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NDc1NzZ8MHwxfHNlYXJjaHwxfHxjaG9jb2xhdGUlMjBjaGlwJTIwY29va2llc3xlbnwwfDJ8fHwxNzc4NDI0NDk3fDA&ixlib=rb-4.1.0&q=80&w=1080' },
    { id: 'item-almond', categoryId: cookies.id, name: 'Almond Biscotti (4 pcs)', price: 20000, sortOrder: 2, description: 'Twice-baked crispy biscotti with whole almonds', imageUrl: 'https://images.unsplash.com/photo-1643750182177-60da9d9b360b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NDc1NzZ8MHwxfHNlYXJjaHwxfHxhbG1vbmQlMjBiaXNjb3R0aXxlbnwwfDJ8fHwxNzc4NDI0NDk4fDA&ixlib=rb-4.1.0&q=80&w=1080' },
  ]

  for (const item of items) {
    await db.menuItem.upsert({
      where: { id: item.id },
      update: { description: item.description, imageUrl: item.imageUrl },
      create: item,
    })
  }

  const botMessages = [
    { key: 'welcome', label: 'Welcome greeting', value: '👋 Welcome to our bakery!\n\nWhat would you like to do?\n\n{categories}\n\nReply with a number to browse and order.\n\n📦 Type *track* to check your order status\n❌ Type *cancel order* to cancel an active order' },
    { key: 'menu_header', label: 'Menu command reply', value: '*Our Menu*\n\n{categories}\n\nReply with a number to browse.' },
    { key: 'invalid_category', label: 'Invalid category input', value: "Hmm, I didn't catch that. Please choose a category:\n\n{categories}\n\nReply with a number." },
    { key: 'items_footer', label: 'Item list footer', value: 'Reply with a number to select, or *back* to see all categories.' },
    { key: 'invalid_item', label: 'Invalid item input', value: 'Please choose a valid item.' },
    { key: 'quantity_prompt', label: 'Quantity prompt', value: 'How many *{item}* would you like?' },
    { key: 'invalid_quantity', label: 'Invalid quantity input', value: 'Please enter a valid quantity (1–99).' },
    { key: 'item_added', label: 'Item added confirmation', value: '✅ Added {qty}× *{item}* to your cart.' },
    { key: 'add_more_prompt', label: 'Add more items prompt', value: 'Add more? Choose a category:\n\n{categories}\n\nOr type *confirm* to place your order.' },
    { key: 'choose_more', label: 'Choose more (fallback)', value: 'Choose a category to add more:\n\n{categories}\n\nOr type *confirm* to place your order.' },
    { key: 'order_summary', label: 'Order summary before confirm', value: '🧾 *Order Summary*\n\n{cart}\n\nReply *yes* to confirm and place your order, or *cancel* to start over.' },
    { key: 'order_placed', label: 'Order placed success', value: '🎉 Order placed! The baker will review it and get back to you shortly.\n\nType *track* to check your order status anytime. Thank you! 🍰' },
    { key: 'order_pending', label: 'Order already pending', value: "Your order is being reviewed by the baker. We'll notify you once it's accepted. 🕐\n\nType *hi* to start a new order." },
    { key: 'cancel', label: 'Order cancelled', value: 'Order cancelled. Type *hi* to start a new order. 👋' },
    { key: 'cart_empty', label: 'Cart is empty', value: 'Your cart is empty.' },
    { key: 'confirm_hint', label: 'Confirm or cancel hint', value: 'Type *confirm* to place order or *cancel* to start over.' },
    { key: 'await_confirm', label: 'Awaiting yes/no confirm', value: 'Reply *yes* to confirm your order or *cancel* to start over.' },
    { key: 'back_to_categories', label: 'Back to categories', value: 'Choose a category:\n\n{categories}\n\nReply with a number.' },
    { key: 'custom_prompt', label: 'Custom order — describe prompt', value: "✏️ Tell us exactly what you'd like — flavor, size, quantity, occasion, any special requirements. Be as specific as possible!" },
    { key: 'custom_confirm', label: 'Custom order — confirm preview', value: "Got it! Here's your custom request:\n\n_{description}_\n\nPrice will be confirmed by the baker.\n\nReply *yes* to send to the baker, or *edit* to retype." },
    { key: 'custom_too_short', label: 'Custom order — too short', value: 'Please give a bit more detail so the baker knows exactly what to make!' },
    { key: 'custom_await_confirm', label: 'Custom order — awaiting yes/edit', value: 'Reply *yes* to send to the baker, or *edit* to retype your request.' },
    { key: 'variant_prompt', label: 'Variant selection prompt', value: 'Which size/variant would you like for *{item}*?' },
    { key: 'variant_footer', label: 'Variant list footer', value: 'Reply with a number to select.' },
    { key: 'invalid_variant', label: 'Invalid variant input', value: 'Please choose a valid option.' },
    { key: 'delivery_date_prompt', label: 'Delivery date/time prompt', value: "📅 When would you like your order? (e.g. *Tomorrow 3pm*, *Friday evening*, *ASAP*)" },
    { key: 'discount_hint', label: 'Discount code hint in summary', value: 'Have a discount code? Type it now, or type *yes* to confirm.' },
    { key: 'discount_min_amount', label: 'Discount code min amount error', value: 'This code requires a minimum order of {amount}.' },
    { key: 'invalid_code', label: 'Invalid discount code', value: "❌ That code isn't valid. Type *yes* to confirm or *cancel* to start over." },
    { key: 'min_order', label: 'Minimum order amount not met', value: 'Minimum order is {amount}. Please add more items to continue.' },
    { key: 'track_no_order', label: 'Track — no order found', value: "You don't have any active orders. Type *hi* to start a new order! 🛍️" },
    { key: 'cancel_no_order', label: 'Cancel — no active order', value: 'No active order found to cancel. Type *hi* to start a new order.' },
    { key: 'cancel_confirmed', label: 'Cancel — order cancelled', value: '✅ Your order has been cancelled. Type *hi* to start a new order.' },
    { key: 'cancel_request_sent', label: 'Cancel — request sent to baker', value: 'Your cancellation request has been sent to the baker. We\'ll confirm shortly.' },
  ]

  for (const msg of botMessages) {
    await db.botMessage.upsert({
      where: { key: msg.key },
      update: { label: msg.label, value: msg.value },
      create: msg,
    })
  }

  console.log('Seed complete ✓')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
