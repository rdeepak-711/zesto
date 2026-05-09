# Task 03 — Seed Data

**Phase:** 1 — Foundation  
**Goal:** Populate the database with bakery config and a sample menu so the bot and dashboard have data to work with immediately.

**Files created:**
- `prisma/seed.ts`

---

- [ ] **Step 1: Write `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // Bakery config — upsert so re-running seed is safe
  await db.bakeryConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      bakeryName: 'Sweet Crumbs Bakery',
      bakerPhone: process.env.BAKER_PHONE ?? '+910000000000',
      whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '') ?? '+910000000000',
      address: '12, MG Road, Bangalore 560001',
      welcomeMessage: 'Hi! Welcome to Sweet Crumbs 🎂\nType *menu* anytime to start over.',
    },
  })

  // Categories
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

  // Menu items (prices in paise: ₹500 = 50000)
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
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
```

- [ ] **Step 2: Add seed script to `package.json`**

In the `"prisma"` section of `package.json` (create it if missing):

```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Also add `ts-node` as a dev dependency:

```bash
npm install -D ts-node
```

- [ ] **Step 3: Run the seed**

```bash
npx prisma db seed
```

Expected output: `Seed complete ✓`

- [ ] **Step 4: Verify in Prisma Studio**

```bash
npx prisma studio
```

Open `http://localhost:5555` in your browser. Check:
- `bakery_config` has 1 row
- `menu_categories` has 3 rows (Cakes, Pastries, Cookies)
- `menu_items` has 8 rows

Close Studio with Ctrl+C when done.

- [ ] **Step 5: Write a test that verifies seed data**

Create `tests/api/seed.test.ts`:

```typescript
import { db } from '@/lib/db'

describe('seed data', () => {
  it('bakery config exists', async () => {
    const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })
    expect(config).not.toBeNull()
    expect(config?.bakeryName).toBe('Sweet Crumbs Bakery')
  })

  it('has 3 menu categories', async () => {
    const count = await db.menuCategory.count()
    expect(count).toBe(3)
  })

  it('has 8 menu items', async () => {
    const count = await db.menuItem.count()
    expect(count).toBe(8)
  })
})
```

Run:

```bash
npm test tests/api/seed.test.ts
```

Expected: `3 passed`.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts tests/api/seed.test.ts package.json
git commit -m "feat: add seed data (bakery config + sample menu)"
```
