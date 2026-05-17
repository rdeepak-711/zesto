/**
 * Seeds Phoenix Photo Studio tenant with all photo frame menu items.
 * Safe to re-run — idempotent via upsert on whatsappNumber unique constraint.
 * Usage: npx tsx prisma/seed-phoenix.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import { bootstrapTenant } from './bootstrapTenant'

const adapter = new PrismaTiDBCloud({ url: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter } as never)

const FRAMES: { name: string; price: number; sortOrder: number }[] = [
  { name: '4×6 inches', price: 200, sortOrder: 1 },
  { name: '5×7 inches', price: 270, sortOrder: 2 },
  { name: '6×8 inches', price: 300, sortOrder: 3 },
  { name: '8×8 inches', price: 350, sortOrder: 4 },
  { name: '5×10 inches', price: 400, sortOrder: 5 },
  { name: '8×10 inches', price: 400, sortOrder: 6 },
  { name: '10×12 inches', price: 550, sortOrder: 7 },
  { name: '12×8 inches', price: 450, sortOrder: 8 },
  { name: '12×15 inches', price: 750, sortOrder: 9 },
  { name: '12×18 inches', price: 900, sortOrder: 10 },
  { name: '15×10 inches', price: 650, sortOrder: 11 },
  { name: '12×20 inches', price: 1100, sortOrder: 12 },
  { name: '16×20 inches', price: 1300, sortOrder: 13 },
  { name: '16×24 inches', price: 1800, sortOrder: 14 },
  { name: '20×24 inches', price: 2000, sortOrder: 15 },
  { name: '20×30 inches', price: 2500, sortOrder: 16 },
]

async function main() {
  console.log('Seeding Phoenix Photo Studio...\n')

  // Upsert tenant
  let tenant = await db.tenant.findUnique({ where: { whatsappNumber: '+917010948386' } })
  if (tenant) {
    console.log(`  ✓ Tenant already exists (${tenant.id})`)
  } else {
    tenant = await db.tenant.create({
      data: {
        businessName: 'Phoenix Photo Studio',
        businessType: 'photo studio',
        ownerPhone: '+917010044626',
        // Placeholder — replace with actual Twilio WhatsApp number when provisioned
        whatsappNumber: '+917010948386',
        currency: 'INR',
        deliveryDateLabel: 'When would you like to collect your order?',
        openDays: '1,2,3,4,5,6',
        openTime: '09:00',
        closeTime: '20:00',
      },
    })
    console.log(`  + Created tenant ${tenant.id}`)
  }

  // Bootstrap bot messages + custom category
  await bootstrapTenant(tenant.id, db as PrismaClient)

  // Phoenix-specific bot message overrides
  const phoenixMessages = [
    {
      key: 'welcome',
      label: 'Welcome greeting',
      value: `👋 Welcome to Phoenix Photo Studio!\n\nWe print and frame your memories in premium quality. What are you looking for today?`,
    },
    {
      key: 'enquiry_mode',
      label: 'Enquiry mode (non-empty = enabled)',
      value: 'true',
    },
    {
      key: 'enquiry_keywords',
      label: 'Keywords that trigger the catalog reply (comma-separated)',
      value: 'frame,photo frame,acrylic',
    },
    {
      key: 'enquiry_frame',
      label: 'Reply when customer asks about frames/pricing',
      value: `📐 *Our Photo Frame Sizes & Prices:*\n\n{pricing}\n\n🙏 The owner will reach out to you shortly!`,
    },
    {
      key: 'enquiry_other',
      label: 'Reply for all other enquiries',
      value: `🙏 Thank you for reaching out to Phoenix Photo Studio!\n\nThe owner has taken note of your message and will contact you shortly.`,
    },
  ]
  for (const msg of phoenixMessages) {
    await db.botMessage.upsert({
      where: { key_tenantId: { key: msg.key, tenantId: tenant.id } },
      update: { value: msg.value },
      create: { key: msg.key, tenantId: tenant.id, label: msg.label, value: msg.value },
    })
    console.log(`  ✓ Bot message: ${msg.key}`)
  }

  // Create Photo Frames category (idempotent)
  const catId = `cat-frames-${tenant.id.slice(0, 8)}`
  await db.menuCategory.upsert({
    where: { id: catId },
    update: {},
    create: {
      id: catId,
      tenantId: tenant.id,
      name: 'Photo Frames',
      sortOrder: 1,
    },
  })
  console.log(`  ✓ Category "Photo Frames" ready`)

  // Upsert all frame items
  for (const frame of FRAMES) {
    const itemId = `item-frame-${tenant.id.slice(0, 8)}-${frame.sortOrder}`
    await db.menuItem.upsert({
      where: { id: itemId },
      update: { price: frame.price },
      create: {
        id: itemId,
        tenantId: tenant.id,
        categoryId: catId,
        name: frame.name,
        price: frame.price,
        sortOrder: frame.sortOrder,
      },
    })
    console.log(`    + ${frame.name}: ₹${frame.price}`)
  }

  console.log(`\nDone. Login with +917010044626 via OTP.\n`)
  console.log('Next steps:')
  console.log('  1. Log in to dashboard → Settings → Integrations → enter Razorpay keys')
  console.log('  2. When Twilio number is provisioned, update whatsappNumber via Settings')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
