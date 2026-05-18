/**
 * Seeds Glow Zone salon tenant with services menu and booking BotMessages.
 * Safe to re-run — idempotent via upsert.
 * Usage: npx tsx prisma/seed-glowzone.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaTiDBCloud({ url: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter } as never)

async function main() {
  const tenant = await (db as any).tenant.upsert({
    where: { whatsappNumber: '+919952050806' },
    update: {
      hasCart: true,
      hasBooking: true,
      hasEnquiry: false,
      hasDelivery: false,
      deliveryDateEnabled: false,
    },
    create: {
      businessName: 'Glow Zone',
      businessType: 'salon',
      ownerPhone: '+919952050806',
      otpNumber: '+917010044626',
      whatsappNumber: '+919952050806',
      currency: 'INR',
      minOrderAmount: 0,
      hasCart: true,
      hasBooking: true,
      hasEnquiry: false,
      hasDelivery: false,
      deliveryDateEnabled: false,
    },
  })

  console.log('Tenant:', tenant.id, tenant.businessName)

  const categories = [
    { name: 'Hair Services', sortOrder: 1 },
    { name: 'Skin & Face', sortOrder: 2 },
    { name: 'Nail & Hands', sortOrder: 3 },
    { name: 'Waxing', sortOrder: 4 },
    { name: 'Combos', sortOrder: 5 },
  ]

  for (const cat of categories) {
    await (db as any).menuCategory.upsert({
      where: { id: `gz-cat-${cat.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `gz-cat-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
        tenantId: tenant.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
        active: true,
        isCustom: false,
      },
    })
  }

  const items = [
    { name: 'Hair Spa', price: 69900, cat: 'hair-services' },
    { name: 'Hair Cut', price: 19900, cat: 'hair-services' },
    { name: 'Hair Spa + Hair Cut', price: 69900, cat: 'combos' },
    { name: 'Facial', price: 39900, cat: 'skin-&-face' },
    { name: 'Bleach', price: 39900, cat: 'skin-&-face' },
    { name: 'Clean-up', price: 29900, cat: 'skin-&-face' },
    { name: 'D-Tan', price: 29900, cat: 'skin-&-face' },
    { name: 'Manicure', price: 29900, cat: 'nail-&-hands' },
    { name: 'Pedicure', price: 29900, cat: 'nail-&-hands' },
    { name: 'Manicure + Pedicure', price: 59900, cat: 'combos' },
    { name: 'Hand Wax', price: 19900, cat: 'waxing' },
    { name: 'Legs Wax', price: 29900, cat: 'waxing' },
    { name: 'Under Arms Wax', price: 9900, cat: 'waxing' },
    { name: 'Wax Combo (Hand + Legs + Under Arms)', price: 49900, cat: 'combos' },
  ]

  for (const item of items) {
    const catId = `gz-cat-${item.cat}`
    await (db as any).menuItem.upsert({
      where: { id: `gz-item-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` },
      update: {},
      create: {
        id: `gz-item-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
        tenantId: tenant.id,
        categoryId: catId,
        name: item.name,
        price: item.price,
        available: true,
        sortOrder: 0,
      },
    })
  }

  const msgs = [
    { key: 'welcome', value: 'Hi! Welcome to *Glow Zone* 💅\n\nWhat can we help you with?\n\n{categories}\n\nType a number to browse.' },
    { key: 'menu_header', value: '*Glow Zone Services* 💅\n\n{categories}' },
    { key: 'booking_ask_name', value: "What's your name? 🌸" },
    { key: 'booking_ask_age', value: 'How old are you? (We ask for treatment suitability)' },
    { key: 'booking_ask_date', value: 'What date would you prefer? (e.g. *this Saturday*, *22 May*)' },
    { key: 'booking_ask_time', value: 'What time works best?' },
    { key: 'booking_confirm_prompt', value: 'Shall we book this? Reply *yes* to confirm.' },
    { key: 'booking_pending', value: "Got it! 🎉 Your booking request is confirmed. We'll send you the exact time very soon!" },
    { key: 'booking_pending_reply', value: "We're reviewing your booking 🌸 We'll confirm your exact time shortly!" },
    { key: 'booking_confirmed', value: '✅ Your appointment is confirmed for *{date}* at *{time}*. See you at Glow Zone! 💅' },
    { key: 'booking_rescheduled', value: "Your appointment has been moved to *{date}* at *{time}*. See you then! 🌸" },
    { key: 'booking_cancelled', value: 'Your booking has been cancelled. Feel free to book again anytime 🙏' },
    { key: 'item_added', value: '✅ Added {qty}× *{item}*.' },
    { key: 'add_more_prompt', value: 'Add more services? Choose a category:\n\n{categories}\n\nOr type *confirm* to book.' },
    { key: 'choose_more', value: 'Choose a category:\n\n{categories}\n\nOr type *confirm*.' },
    { key: 'order_summary', value: '🧾 *Booking Summary*\n\n{cart}' },
    { key: 'quantity_prompt', value: 'How many *{item}*?' },
    { key: 'cancel', value: 'Booking cancelled. Type *hi* to start again. 👋' },
  ]

  for (const msg of msgs) {
    await (db as any).botMessage.upsert({
      where: { key_tenantId: { key: msg.key, tenantId: tenant.id } },
      update: { value: msg.value },
      create: { key: msg.key, tenantId: tenant.id, label: msg.key, value: msg.value },
    })
  }

  console.log('Glow Zone seeded successfully')
}

main().catch(console.error).finally(() => db.$disconnect())
