# Task 02 — Prisma Schema + PlanetScale Connection

**Phase:** 1 — Foundation  
**Goal:** Define the full MySQL schema via Prisma, connect to PlanetScale, and run the first migration.

**Files created/modified:**
- `prisma/schema.prisma`
- `src/lib/db.ts`
- `.env.local` (you update manually — DATABASE_URL)

---

- [ ] **Step 1: Initialise Prisma**

```bash
npx prisma init --datasource-provider mysql
```

This creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`.

- [ ] **Step 2: Get your PlanetScale connection string**

1. Go to [planetscale.com](https://planetscale.com), create a free database named `zesto`
2. Click **Connect** → choose **Prisma**
3. Copy the `DATABASE_URL` — it looks like:
   ```
   mysql://user:pass@aws.connect.psdb.cloud/zesto?ssl={"rejectUnauthorized":true}
   ```
4. Paste it into `.env.local` as `DATABASE_URL`

- [ ] **Step 3: Write `prisma/schema.prisma`**

Replace the entire file:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}

model BakeryConfig {
  id             Int    @id @default(1)
  bakeryName     String @db.VarChar(100)
  bakerPhone     String @db.VarChar(20)
  whatsappNumber String @db.VarChar(20)
  logoUrl        String? @db.VarChar(500)
  address        String? @db.Text
  currency       String @default("INR") @db.VarChar(3)
  welcomeMessage String @default("Welcome! How can I help you today?") @db.Text

  @@map("bakery_config")
}

model MenuCategory {
  id        String     @id @default(uuid())
  name      String     @db.VarChar(100)
  sortOrder Int        @default(0)
  active    Boolean    @default(true)
  items     MenuItem[]

  @@map("menu_categories")
}

model MenuItem {
  id          String       @id @default(uuid())
  categoryId  String
  category    MenuCategory @relation(fields: [categoryId], references: [id])
  name        String       @db.VarChar(100)
  description String?      @db.Text
  price       Int
  imageUrl    String?      @db.VarChar(500)
  available   Boolean      @default(true)
  sortOrder   Int          @default(0)
  orderItems  OrderItem[]

  @@index([categoryId])
  @@map("menu_items")
}

model Order {
  id             String      @id @default(uuid())
  customerPhone  String      @db.VarChar(20)
  customerName   String      @db.VarChar(100)
  status         OrderStatus @default(PENDING)
  totalAmount    Int
  paymentLinkId  String?     @db.VarChar(100)
  paymentLinkUrl String?     @db.VarChar(500)
  bakerNotifiedAt DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  items          OrderItem[]
  messages       Message[]

  @@index([customerPhone])
  @@index([status])
  @@map("orders")
}

model OrderItem {
  id         String   @id @default(uuid())
  orderId    String
  order      Order    @relation(fields: [orderId], references: [id])
  menuItemId String
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id])
  name       String   @db.VarChar(100)
  price      Int
  quantity   Int

  @@index([orderId])
  @@index([menuItemId])
  @@map("order_items")
}

model Message {
  id            String           @id @default(uuid())
  customerPhone String           @db.VarChar(20)
  body          String           @db.Text
  direction     MessageDirection
  orderId       String?
  order         Order?           @relation(fields: [orderId], references: [id])
  twilioSid     String?          @db.VarChar(100) @unique
  createdAt     DateTime         @default(now())

  @@index([customerPhone])
  @@index([orderId])
  @@map("messages")
}

model BotSession {
  id            String   @id @default(uuid())
  customerPhone String   @unique @db.VarChar(20)
  state         String   @default("IDLE") @db.VarChar(50)
  cartJson      Json     @default("[]")
  contextJson   Json     @default("{}")
  lastActive    DateTime @default(now()) @updatedAt

  @@map("bot_sessions")
}

model OtpSession {
  id        String   @id @default(uuid())
  phone     String   @db.VarChar(20)
  codeHash  String   @db.VarChar(100)
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([phone])
  @@map("otp_sessions")
}

enum OrderStatus {
  PENDING
  ACCEPTED
  REJECTED
  PAID
  COMPLETED
}

enum MessageDirection {
  IN
  OUT
}
```

- [ ] **Step 4: Push schema to PlanetScale**

PlanetScale uses `db push` instead of migrations (it manages migrations internally):

```bash
npx prisma db push
```

Expected output ends with: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 5: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`.

- [ ] **Step 6: Write `src/lib/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 7: Write a connection test**

Create `tests/api/db-connection.test.ts`:

```typescript
import { db } from '@/lib/db'

describe('database connection', () => {
  it('can query the database', async () => {
    // BakeryConfig always has row id=1 after seeding (Task 03 adds it)
    // For now just verify the connection doesn't throw
    const count = await db.menuCategory.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
```

Run:

```bash
npm test tests/api/db-connection.test.ts
```

Expected: `1 passed`. If it fails, check `DATABASE_URL` in `.env.local`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma src/lib/db.ts tests/api/db-connection.test.ts
git commit -m "feat: add Prisma schema (MySQL) and PlanetScale connection"
```
