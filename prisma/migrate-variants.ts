/**
 * One-time migration: MenuItemVariant → CategoryField / CategoryFieldOption / ItemFieldOption
 * Also migrates OrderItem.variantName → fieldsJson.
 * Run once after prisma db push: npx tsx prisma/migrate-variants.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaTiDBCloud({ url: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter } as never)

async function main() {
  // 1. Read existing variants via raw SQL
  type RawVariant = {
    id: string
    menu_item_id: string
    name: string
    price_delta: number
    sort_order: number
    category_id: string
    tenant_id: string
  }

  const variants = await db.$queryRaw<RawVariant[]>`
    SELECT v.id, v.menu_item_id, v.name, v.price_delta, v.sort_order,
           i.category_id, i.tenant_id
    FROM menu_item_variants v
    JOIN menu_items i ON i.id = v.menu_item_id
  `

  if (variants.length === 0) {
    console.log('No variants to migrate.')
  } else {
    // Group by categoryId — one "Size" field per category
    const categoryMap = new Map<string, { categoryId: string; tenantId: string; variants: RawVariant[] }>()
    for (const v of variants) {
      if (!categoryMap.has(v.category_id)) {
        categoryMap.set(v.category_id, { categoryId: v.category_id, tenantId: v.tenant_id, variants: [] })
      }
      categoryMap.get(v.category_id)!.variants.push(v)
    }

    for (const [, { categoryId, tenantId, variants: catVariants }] of categoryMap) {
      try {
        // Create or find the "Size" CategoryField for this category
        let field = await db.categoryField.findFirst({ where: { categoryId, name: 'Size' } })
        if (!field) {
          field = await db.categoryField.create({
            data: { tenantId, categoryId, name: 'Size', type: 'select', required: true, sortOrder: 0 },
          })
        }

        // Deduplicate options by name, create CategoryFieldOption for each
        const optionByName = new Map<string, { id: string; priceDelta: number }>()
        const sorted = [...catVariants].sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        for (const v of sorted) {
          if (optionByName.has(v.name)) continue
          const existing = await db.categoryFieldOption.findFirst({ where: { fieldId: field.id, label: v.name } })
          if (existing) {
            optionByName.set(v.name, { id: existing.id, priceDelta: existing.priceDelta })
          } else {
            const opt = await db.categoryFieldOption.create({
              data: { fieldId: field.id, label: v.name, priceDelta: Number(v.price_delta), sortOrder: Number(v.sort_order) },
            })
            optionByName.set(v.name, { id: opt.id, priceDelta: Number(v.price_delta) })
          }
        }

        // Create ItemFieldOption rows for each item→option mapping
        for (const v of catVariants) {
          const opt = optionByName.get(v.name)
          if (!opt) continue
          await db.itemFieldOption.upsert({
            where: { menuItemId_optionId: { menuItemId: v.menu_item_id, optionId: opt.id } },
            update: {},
            create: { menuItemId: v.menu_item_id, fieldId: field.id, optionId: opt.id },
          })
        }

        console.log(`  ✓ Category ${categoryId}: ${catVariants.length} variants processed`)
      } catch (e) {
        console.error(`  ✗ Category ${categoryId} failed:`, e)
      }
    }
    console.log(`Migrated variants for ${categoryMap.size} categories.`)
  }

  // 2. Migrate OrderItem.variantName → fieldsJson via raw SQL
  type RawOrderItem = { id: string; variant_name: string }
  let orderItems: RawOrderItem[] = []
  try {
    orderItems = await db.$queryRaw<RawOrderItem[]>`
      SELECT id, variant_name FROM order_items
      WHERE variant_name IS NOT NULL AND variant_name != ''
    `
  } catch {
    // column may already be removed
    console.log('variant_name column not present (already migrated or removed).')
  }

  for (const item of orderItems) {
    const fieldsJson = JSON.stringify([{ name: 'Size', value: item.variant_name, priceDelta: 0 }])
    await db.$executeRaw`UPDATE order_items SET fields_json = ${fieldsJson} WHERE id = ${item.id}`
  }
  if (orderItems.length > 0) {
    console.log(`Migrated ${orderItems.length} order items: variantName → fieldsJson.`)
  }

  console.log('Migration complete.')
}

main().catch(console.error).finally(() => db.$disconnect())
