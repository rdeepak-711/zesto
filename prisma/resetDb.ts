import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import { bootstrapTenant } from './bootstrapTenant'

const adapter = new PrismaTiDBCloud({ url: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter } as never)

const TENANT_ID = 'demo-bakery-001'

async function deleteAll() {
  console.log('Deleting all data in FK-safe order...')
  await db.orderFeedback.deleteMany()
  await db.orderItem.deleteMany()
  await db.message.deleteMany()
  await db.booking.deleteMany()
  await db.order.deleteMany()
  await db.broadcast.deleteMany()
  await db.discountCode.deleteMany()
  await db.botSession.deleteMany()
  await db.botRule.deleteMany()
  await db.botMessage.deleteMany()
  await db.otpSession.deleteMany()
  await db.itemFieldOption.deleteMany()
  await db.categoryFieldOption.deleteMany()
  await db.categoryField.deleteMany()
  await db.menuItem.deleteMany()
  await db.menuCategory.deleteMany()
  await db.tenant.deleteMany()
  console.log('All data deleted.')
}

async function seedTenant() {
  console.log(`Creating tenant ${TENANT_ID}...`)
  await db.tenant.create({
    data: {
      id: TENANT_ID,
      businessName: 'Sweet Crumbs Bakery',
      businessType: 'bakery',
      ownerPhone: '+917010044626',
      otpNumber: '+917010044626',
      whatsappNumber: '+14155238886',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      openDays: '1,2,3,4,5,6',
      openTime: '09:00',
      closeTime: '21:00',
      hasCart: true,
      hasBooking: false,
      hasEnquiry: false,
      hasDelivery: true,
      deliveryDateEnabled: true,
      deliveryDateLabel: 'When do you need your order? (e.g. *Friday 3pm*, *this Saturday morning*)',
      minOrderAmount: 50000,
      address: 'Nungambakkam, Chennai',
    },
  })
  console.log('Tenant created.')
}

async function seedMenu() {
  console.log('Seeding menu...')

  // ── Category: Signature Cakes ──────────────────────────────────────────────
  const sigCakes = await db.menuCategory.create({
    data: {
      tenantId: TENANT_ID,
      name: 'Signature Cakes',
      sortOrder: 1,
    },
  })

  await db.menuItem.createMany({
    data: [
      { tenantId: TENANT_ID, categoryId: sigCakes.id, name: 'Chocolate Truffle Cake', price: 75000, description: '1kg | Rich dark chocolate ganache' },
      { tenantId: TENANT_ID, categoryId: sigCakes.id, name: 'Vanilla Butter Cake',    price: 60000, description: '1kg | Classic vanilla sponge with buttercream' },
      { tenantId: TENANT_ID, categoryId: sigCakes.id, name: 'Red Velvet Cake',        price: 80000, description: '1kg | Cream cheese frosting' },
      { tenantId: TENANT_ID, categoryId: sigCakes.id, name: 'Mango Mousse Cake',      price: 85000, description: '1kg | Fresh Alphonso mango mousse' },
      { tenantId: TENANT_ID, categoryId: sigCakes.id, name: 'Eggless Black Forest',   price: 80000, description: '1kg | Cherries & whipped cream' },
    ],
  })

  // CategoryField: Size (sortOrder: 1)
  const sizeField = await db.categoryField.create({
    data: {
      tenantId: TENANT_ID,
      categoryId: sigCakes.id,
      name: 'Size',
      type: 'select',
      required: true,
      sortOrder: 1,
    },
  })

  await db.categoryFieldOption.createMany({
    data: [
      { fieldId: sizeField.id, label: '500g (serves 6–8)',    priceDelta: -25000, sortOrder: 1 },
      { fieldId: sizeField.id, label: '1kg (serves 12–15)',   priceDelta: 0,      sortOrder: 2 },
      { fieldId: sizeField.id, label: '1.5kg (serves 18–22)', priceDelta: 40000,  sortOrder: 3 },
      { fieldId: sizeField.id, label: '2kg (serves 25–30)',   priceDelta: 80000,  sortOrder: 4 },
    ],
  })

  // CategoryField: Type (sortOrder: 2)
  const typeField = await db.categoryField.create({
    data: {
      tenantId: TENANT_ID,
      categoryId: sigCakes.id,
      name: 'Type',
      type: 'select',
      required: true,
      sortOrder: 2,
    },
  })

  await db.categoryFieldOption.createMany({
    data: [
      { fieldId: typeField.id, label: 'Regular (with egg)', priceDelta: 0,    sortOrder: 1 },
      { fieldId: typeField.id, label: 'Eggless (+₹50)',     priceDelta: 5000, sortOrder: 2 },
    ],
  })

  // ── ItemFieldOption: link each Signature Cake item to each field option ────
  const sigCakeItems = await db.menuItem.findMany({
    where: { categoryId: sigCakes.id },
    select: { id: true },
  })

  const allFieldOptions = await db.categoryFieldOption.findMany({
    where: { fieldId: { in: [sizeField.id, typeField.id] } },
    select: { id: true, fieldId: true },
  })

  await db.itemFieldOption.createMany({
    data: sigCakeItems.flatMap(item =>
      allFieldOptions.map(opt => ({
        menuItemId: item.id,
        fieldId:    opt.fieldId,
        optionId:   opt.id,
      }))
    ),
  })

  // ── Category: Cupcakes ─────────────────────────────────────────────────────
  const cupcakes = await db.menuCategory.create({
    data: {
      tenantId: TENANT_ID,
      name: 'Cupcakes',
      sortOrder: 2,
    },
  })

  await db.menuItem.createMany({
    data: [
      { tenantId: TENANT_ID, categoryId: cupcakes.id, name: 'Chocolate Cupcakes (6 pcs)',  price: 30000 },
      { tenantId: TENANT_ID, categoryId: cupcakes.id, name: 'Vanilla Cupcakes (6 pcs)',    price: 28000 },
      { tenantId: TENANT_ID, categoryId: cupcakes.id, name: 'Red Velvet Cupcakes (6 pcs)', price: 35000 },
      { tenantId: TENANT_ID, categoryId: cupcakes.id, name: 'Assorted Box (12 pcs)',        price: 55000, description: 'Mix of chocolate, vanilla & red velvet' },
    ],
  })

  // ── Category: Cookies & Bars ───────────────────────────────────────────────
  const cookiesBars = await db.menuCategory.create({
    data: {
      tenantId: TENANT_ID,
      name: 'Cookies & Bars',
      sortOrder: 3,
    },
  })

  await db.menuItem.createMany({
    data: [
      { tenantId: TENANT_ID, categoryId: cookiesBars.id, name: 'Chocolate Chip Cookies (12 pcs)', price: 25000 },
      { tenantId: TENANT_ID, categoryId: cookiesBars.id, name: 'Brownies (9 pcs)',                price: 32000, description: 'Fudgy, rich dark chocolate' },
      { tenantId: TENANT_ID, categoryId: cookiesBars.id, name: 'Blondies (9 pcs)',                price: 30000, description: 'Caramel & white chocolate' },
    ],
  })

  console.log('Menu seeded: Signature Cakes, Cupcakes, Cookies & Bars.')
}

async function main() {
  try {
    await deleteAll()
    await seedTenant()
    await seedMenu()
    await bootstrapTenant(TENANT_ID, db)
    console.log(`\nreset complete — tenant ${TENANT_ID} is ready.`)
  } catch (err) {
    console.error('resetDb failed:', err)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

main()
