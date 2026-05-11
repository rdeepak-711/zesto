/**
 * One-time backfill: creates the first Tenant from env vars
 * and stamps tenantId onto all existing rows.
 * Safe to re-run — idempotent.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaTiDBCloud({ url: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter } as never)

async function main() {
  const ownerPhone = process.env.BAKER_PHONE!
  const whatsappNumber = (process.env.TWILIO_WHATSAPP_NUMBER ?? '').replace('whatsapp:', '')

  if (!ownerPhone || !whatsappNumber) {
    throw new Error('BAKER_PHONE and TWILIO_WHATSAPP_NUMBER must be set in .env.local')
  }

  // Create or find the seed tenant
  let tenant = await db.tenant.findFirst({ where: { ownerPhone } })
  if (!tenant) {
    tenant = await db.tenant.create({
      data: {
        businessName: 'Sweet Crumbs',
        businessType: 'bakery',
        ownerPhone,
        whatsappNumber,
        currency: 'INR',
        minOrderAmount: 0,
      },
    })
    console.log(`✅ Tenant created: ${tenant.id} (${tenant.businessName})`)
  } else {
    console.log(`ℹ️  Tenant already exists: ${tenant.id} (${tenant.businessName})`)
  }

  const tid = tenant.id

  // Backfill each table — only rows where tenantId IS NULL
  const [orders, categories, items, sessions, botMessages, botRules, messages, broadcasts, discounts, otpSessions] =
    await Promise.all([
      db.order.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      db.menuCategory.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      db.menuItem.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      db.botSession.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      db.botMessage.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      db.botRule.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      db.message.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      db.broadcast.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      db.discountCode.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      db.otpSession.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
    ])

  console.log(`\n📦 Backfilled:`)
  console.log(`  Orders:        ${orders.count}`)
  console.log(`  Categories:    ${categories.count}`)
  console.log(`  Menu items:    ${items.count}`)
  console.log(`  Bot sessions:  ${sessions.count}`)
  console.log(`  Bot messages:  ${botMessages.count}`)
  console.log(`  Bot rules:     ${botRules.count}`)
  console.log(`  Messages:      ${messages.count}`)
  console.log(`  Broadcasts:    ${broadcasts.count}`)
  console.log(`  Discounts:     ${discounts.count}`)
  console.log(`  OTP sessions:  ${otpSessions.count}`)
  console.log(`\n✅ Backfill complete. Tenant ID: ${tid}`)
  console.log(`\nAdd to Vercel env vars:`)
  console.log(`  SEED_TENANT_ID=${tid}`)
}

main().catch(console.error).finally(() => db.$disconnect())
