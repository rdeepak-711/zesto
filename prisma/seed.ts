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

  console.log('Seed complete ✓')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
