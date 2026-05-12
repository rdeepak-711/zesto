import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import { defaultBotMessages } from './seed'

export async function bootstrapTenant(tenantId: string, db?: PrismaClient) {
  let localDb: PrismaClient | undefined
  if (!db) {
    const adapter = new PrismaTiDBCloud({ url: process.env.DATABASE_URL! })
    localDb = new PrismaClient({ adapter } as never)
    db = localDb
  }

  const messages = defaultBotMessages(tenantId)

  for (const msg of messages) {
    await db.botMessage.upsert({
      where: { key_tenantId: { key: msg.key, tenantId } },
      update: {},
      create: msg,
    })
  }

  // Ensure custom category + item sentinel exists for this tenant (idempotent)
  const catId = `cat-custom-${tenantId.slice(0, 8)}`
  const itemId = `item-custom-${tenantId.slice(0, 8)}`

  await db.menuCategory.upsert({
    where: { id: catId },
    update: {},
    create: { id: catId, tenantId, name: 'Custom Order', isCustom: true, sortOrder: 999 },
  })
  await db.menuItem.upsert({
    where: { id: itemId },
    update: {},
    create: { id: itemId, tenantId, categoryId: catId, name: 'Custom Order', price: 0 },
  })

  console.log(`bootstrapTenant: seeded ${messages.length} messages for tenant ${tenantId}`)

  if (localDb) {
    await localDb.$disconnect()
  }
}

// Run directly: npx tsx prisma/bootstrapTenant.ts <tenantId>
async function main() {
  const tenantId = process.argv[2]
  if (!tenantId) {
    console.error('Usage: npx tsx prisma/bootstrapTenant.ts <tenantId>')
    process.exit(1)
  }
  await bootstrapTenant(tenantId)
}

if (require.main === module) {
  main().catch(console.error)
}
