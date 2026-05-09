# Task 04 — Health Check API + First Vercel Deploy

**Phase:** 1 — Foundation  
**Goal:** Add a `/api/health` endpoint that pings the DB, then deploy the app live on Vercel. After this task you have a real URL.

**Files created:**
- `src/app/api/health/route.ts`
- `src/types/index.ts`

---

- [ ] **Step 1: Write `src/types/index.ts`**

Shared TypeScript types used across the project. Define them all here once.

```typescript
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PAID' | 'COMPLETED'
export type MessageDirection = 'IN' | 'OUT'

export type BotState =
  | 'IDLE'
  | 'AWAITING_CATEGORY'
  | 'AWAITING_ITEM'
  | 'AWAITING_QUANTITY'
  | 'AWAITING_MORE'
  | 'AWAITING_CONFIRMATION'
  | 'ORDER_PENDING'

export interface CartItem {
  menuItemId: string
  name: string
  price: number // paise
  quantity: number
}

export interface BotSessionData {
  customerPhone: string
  state: BotState
  cart: CartItem[]
}
```

- [ ] **Step 2: Write the health check API route**

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'connected' })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', db: 'disconnected' },
      { status: 503 }
    )
  }
}
```

- [ ] **Step 3: Test the health endpoint locally**

Start the dev server:

```bash
npm run dev
```

In a second terminal:

```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok","db":"connected"}`

- [ ] **Step 4: Write a unit test for the health route**

Create `tests/api/health.test.ts`:

```typescript
import { GET } from '@/app/api/health/route'

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
  },
}))

describe('GET /api/health', () => {
  it('returns ok when DB responds', async () => {
    const response = await GET()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.db).toBe('connected')
  })
})
```

Run:

```bash
npm test tests/api/health.test.ts
```

Expected: `1 passed`.

- [ ] **Step 5: Deploy to Vercel**

Install Vercel CLI if you haven't:

```bash
npm i -g vercel
```

From the `zesto/` directory:

```bash
vercel
```

Follow the prompts:
- Link to your Vercel account
- Project name: `zesto` (or your preferred name)
- Framework: **Next.js** (auto-detected)
- Root directory: `.` (current)
- Override build settings: **No**

- [ ] **Step 6: Add environment variables to Vercel**

```bash
vercel env add DATABASE_URL
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
vercel env add TWILIO_WHATSAPP_NUMBER
vercel env add RAZORPAY_KEY_ID
vercel env add RAZORPAY_KEY_SECRET
vercel env add RAZORPAY_WEBHOOK_SECRET
vercel env add JWT_SECRET
vercel env add BAKER_PHONE
vercel env add NEXT_PUBLIC_WHATSAPP_NUMBER
vercel env add NEXT_PUBLIC_APP_URL
```

For each command, paste the value when prompted and select **Production + Preview + Development**.

Alternatively, go to your Vercel project dashboard → Settings → Environment Variables and add them through the UI.

- [ ] **Step 7: Deploy to production**

```bash
vercel --prod
```

This outputs your production URL, e.g. `https://zesto.vercel.app`.

- [ ] **Step 8: Verify the live health endpoint**

```bash
curl https://YOUR-DEPLOYMENT.vercel.app/api/health
```

Expected: `{"status":"ok","db":"connected"}`

If you see `db: disconnected`, the `DATABASE_URL` env var wasn't set correctly — recheck Step 6.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/health/route.ts src/types/index.ts tests/api/health.test.ts
git commit -m "feat: add health check API and deploy to Vercel"
```
