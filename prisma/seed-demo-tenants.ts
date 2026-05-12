/**
 * Creates the 5 demo tenants and seeds their bot messages + custom category.
 * Safe to re-run — idempotent via upsert on whatsappNumber unique constraint.
 * Usage: npx tsx prisma/seed-demo-tenants.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import { bootstrapTenant } from './bootstrapTenant'

const adapter = new PrismaTiDBCloud({ url: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter } as never)

const DEMO_TENANTS = [
  {
    businessName: 'Sweet Crumbs',
    businessType: 'bakery',
    ownerPhone: '+919900000001',
    whatsappNumber: '+919900000001',
    currency: 'INR',
  },
  {
    businessName: 'Spice Garden',
    businessType: 'restaurant',
    ownerPhone: '+919900000002',
    whatsappNumber: '+919900000002',
    currency: 'INR',
  },
  {
    businessName: 'Print Studio',
    businessType: 'poster seller',
    ownerPhone: '+919900000003',
    whatsappNumber: '+919900000003',
    currency: 'INR',
  },
  {
    businessName: 'Threads Co',
    businessType: 't-shirt seller',
    ownerPhone: '+919900000004',
    whatsappNumber: '+919900000004',
    currency: 'INR',
  },
  {
    businessName: 'Step Up',
    businessType: 'shoe seller',
    ownerPhone: '+919900000005',
    whatsappNumber: '+919900000005',
    currency: 'INR',
  },
]

async function main() {
  console.log('Creating 5 demo tenants...\n')

  for (const data of DEMO_TENANTS) {
    // Upsert tenant on whatsappNumber unique key
    const existing = await db.tenant.findUnique({ where: { whatsappNumber: data.whatsappNumber } })

    let tenant: { id: string; businessName: string }
    if (existing) {
      console.log(`  ✓ ${data.businessName} already exists (${existing.id})`)
      tenant = existing
    } else {
      tenant = await db.tenant.create({ data })
      console.log(`  + Created ${data.businessName} (${tenant.id})`)
    }

    await bootstrapTenant(tenant.id, db as PrismaClient)
    console.log(`    → Bootstrapped messages + custom category\n`)
  }

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
