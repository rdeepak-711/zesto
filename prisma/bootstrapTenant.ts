import { PrismaClient } from '@prisma/client'
import { defaultBotMessages } from './seed'

const db = new PrismaClient()

export async function bootstrapTenant(tenantId: string) {
  const messages = defaultBotMessages(tenantId)

  for (const msg of messages) {
    await db.botMessage.upsert({
      where: { key_tenantId: { key: msg.key, tenantId } },
      update: {},
      create: msg,
    })
  }

  // Ensure custom category + item sentinel exists for this tenant
  const existingCustomCat = await db.menuCategory.findFirst({
    where: { tenantId, isCustom: true },
  })
  if (!existingCustomCat) {
    const cat = await db.menuCategory.create({
      data: {
        id: `cat-custom-${tenantId.slice(0, 8)}`,
        tenantId,
        name: 'Custom Order',
        isCustom: true,
        sortOrder: 999,
      },
    })
    await db.menuItem.create({
      data: {
        id: `item-custom-${tenantId.slice(0, 8)}`,
        tenantId,
        categoryId: cat.id,
        name: 'Custom Order',
        price: 0,
      },
    })
  }

  console.log(`bootstrapTenant: seeded ${messages.length} messages for tenant ${tenantId}`)
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

main().catch(console.error).finally(() => db.$disconnect())
