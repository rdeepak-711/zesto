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
    { id: 'item-choc-cake', categoryId: cakes.id, name: 'Chocolate Fudge Cake (1kg)', price: 80000, sortOrder: 1 },
    { id: 'item-vanilla-cake', categoryId: cakes.id, name: 'Vanilla Dream Cake (1kg)', price: 70000, sortOrder: 2 },
    { id: 'item-red-velvet', categoryId: cakes.id, name: 'Red Velvet Cake (1kg)', price: 90000, sortOrder: 3 },
    { id: 'item-croissant', categoryId: pastries.id, name: 'Butter Croissant', price: 8000, sortOrder: 1 },
    { id: 'item-eclair', categoryId: pastries.id, name: 'Chocolate Éclair', price: 10000, sortOrder: 2 },
    { id: 'item-danish', categoryId: pastries.id, name: 'Fruit Danish', price: 9000, sortOrder: 3 },
    { id: 'item-choc-chip', categoryId: cookies.id, name: 'Choc Chip Cookies (6 pcs)', price: 25000, sortOrder: 1 },
    { id: 'item-almond', categoryId: cookies.id, name: 'Almond Biscotti (4 pcs)', price: 20000, sortOrder: 2 },
  ]

  for (const item of items) {
    await db.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    })
  }

  console.log('Seed complete ✓')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
