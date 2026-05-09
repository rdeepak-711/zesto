# Task 08 — Twilio Webhook Handler

**Phase:** 2 — WhatsApp Bot  
**Goal:** Wire the Twilio inbound WhatsApp webhook to the bot state machine. This is the entry point for all customer messages.

**Files created:**
- `src/app/api/webhook/twilio/route.ts`
- `tests/api/webhook-twilio.test.ts`

**How it works:**
1. Twilio POSTs a form-encoded request to `/api/webhook/twilio` for every inbound WhatsApp message
2. We load the customer's session, run it through the state machine, save the new session, and reply

---

- [ ] **Step 1: Write the failing tests**

Create `tests/api/webhook-twilio.test.ts`:

```typescript
import { POST } from '@/app/api/webhook/twilio/route'

const mockGetSession = vi.fn()
const mockSaveSession = vi.fn()
const mockTransition = vi.fn()
const mockSendWhatsApp = vi.fn()
const mockFindMany = vi.fn()
const mockOrderCreate = vi.fn()
const mockMessageCreate = vi.fn()

vi.mock('@/bot/session', () => ({
  getSession: mockGetSession,
  saveSession: mockSaveSession,
}))
vi.mock('@/bot/state-machine', () => ({
  transition: mockTransition,
}))
vi.mock('@/lib/twilio', () => ({
  sendWhatsApp: mockSendWhatsApp,
}))
vi.mock('@/lib/db', () => ({
  db: {
    menuCategory: { findMany: mockFindMany },
    menuItem: { findMany: vi.fn().mockResolvedValue([]) },
    order: { create: mockOrderCreate },
    message: { create: mockMessageCreate },
    bakeryConfig: { findUnique: vi.fn().mockResolvedValue({ bakeryName: 'Test Bakery', bakerPhone: '+910000000000' }) },
  },
}))

function makeRequest(body: Record<string, string>): Request {
  const params = new URLSearchParams(body)
  return new Request('http://localhost/api/webhook/twilio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
}

describe('POST /api/webhook/twilio', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ customerPhone: 'whatsapp:+911234567890', state: 'IDLE', cart: [] })
    mockFindMany.mockResolvedValue([])
    mockSaveSession.mockResolvedValue(undefined)
    mockSendWhatsApp.mockResolvedValue('SM123')
    mockMessageCreate.mockResolvedValue({})
  })

  it('returns 200 and sends replies', async () => {
    mockTransition.mockResolvedValue({
      nextState: 'AWAITING_CATEGORY',
      replies: ['Choose a category:\n1. Cakes'],
    })
    const req = makeRequest({ From: 'whatsapp:+911234567890', Body: 'Hi', MessageSid: 'SM001' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockSendWhatsApp).toHaveBeenCalledWith('+911234567890', 'Choose a category:\n1. Cakes')
  })

  it('creates an order when shouldCreateOrder is true', async () => {
    mockTransition.mockResolvedValue({
      nextState: 'ORDER_PENDING',
      replies: ['Order placed!'],
      shouldCreateOrder: true,
      updatedCart: [{ menuItemId: 'item-1', name: 'Cake', price: 80000, quantity: 1 }],
    })
    mockOrderCreate.mockResolvedValue({ id: 'order-1' })
    const req = makeRequest({ From: 'whatsapp:+911234567890', Body: 'yes', MessageSid: 'SM002' })
    await POST(req)
    expect(mockOrderCreate).toHaveBeenCalled()
  })

  it('returns 400 if From or Body is missing', async () => {
    const req = makeRequest({ From: '', Body: '' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
npm test tests/api/webhook-twilio.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/webhook/twilio/route'`

- [ ] **Step 3: Write `src/app/api/webhook/twilio/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, saveSession } from '@/bot/session'
import { transition } from '@/bot/state-machine'
import { sendWhatsApp } from '@/lib/twilio'
import { notifyBaker } from '@/bot/handlers'

export async function POST(request: Request) {
  const formData = await request.formData()
  const from = formData.get('From') as string
  const body = formData.get('Body') as string
  const twilioSid = formData.get('MessageSid') as string

  if (!from || !body) {
    return NextResponse.json({ error: 'Missing From or Body' }, { status: 400 })
  }

  // Strip whatsapp: prefix for storage
  const customerPhone = from.startsWith('whatsapp:') ? from.slice(9) : from

  // Load session and menu data in parallel
  const [session, categories, items, config] = await Promise.all([
    getSession(customerPhone),
    db.menuCategory.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    db.menuItem.findMany({ where: { available: true }, orderBy: { sortOrder: 'asc' } }),
    db.bakeryConfig.findUnique({ where: { id: 1 } }),
  ])

  // Store inbound message
  await db.message.create({
    data: {
      customerPhone,
      body,
      direction: 'IN',
      twilioSid,
    },
  }).catch(() => {}) // Ignore duplicate SID errors

  // Run state machine
  const result = await transition(session, body, { categories, items })

  // Create order if bot says so
  let orderId: string | undefined
  if (result.shouldCreateOrder && result.updatedCart && result.updatedCart.length > 0) {
    const cart = result.updatedCart
    const totalAmount = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const order = await db.order.create({
      data: {
        customerPhone,
        customerName: customerPhone, // updated later if we collect name
        totalAmount,
        items: {
          create: cart.map((item) => ({
            menuItemId: item.menuItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
    })
    orderId = order.id

    // Notify baker
    if (config) {
      await notifyBaker(config.bakerPhone, order.id, cart, totalAmount, customerPhone).catch(console.error)
    }
  }

  // Save new session state
  const updatedCart = result.updatedCart ?? session.cart
  await saveSession({
    customerPhone,
    state: result.nextState,
    cart: result.nextState === 'ORDER_PENDING' ? [] : updatedCart,
    context: result.context,
  })

  // Send all replies
  for (const reply of result.replies) {
    await sendWhatsApp(customerPhone, reply)
    await db.message.create({
      data: { customerPhone, body: reply, direction: 'OUT', orderId },
    })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Write `src/bot/handlers.ts`**

This handles the baker notification logic (used by the webhook, and also in Task 10 for baker reply handling):

```typescript
import { sendWhatsApp } from '@/lib/twilio'
import { formatCurrency } from './messages'
import type { CartItem } from '@/types'

export async function notifyBaker(
  bakerPhone: string,
  orderId: string,
  cart: CartItem[],
  totalAmount: number,
  customerPhone: string
): Promise<void> {
  const lines = cart.map(i => `• ${i.quantity}x ${i.name} — ${formatCurrency(i.price * i.quantity)}`)
  const body = [
    `🔔 *New Order!*`,
    `Customer: ${customerPhone}`,
    ``,
    lines.join('\n'),
    ``,
    `*Total: ${formatCurrency(totalAmount)}*`,
    ``,
    `Reply *1* to Accept or *2* to Reject`,
    `Order ID: ${orderId}`,
  ].join('\n')

  await sendWhatsApp(bakerPhone, body)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test tests/api/webhook-twilio.test.ts
```

Expected: `3 passed`.

- [ ] **Step 6: Configure Twilio webhook URL**

After your Vercel deploy is live (Task 04):

1. Go to [console.twilio.com](https://console.twilio.com)
2. Messaging → Try it out → Send a WhatsApp message (or Messaging → Senders → WhatsApp Senders)
3. Set the **When a message comes in** webhook URL to:
   `https://YOUR-DEPLOYMENT.vercel.app/api/webhook/twilio`
4. Method: **HTTP POST**

For local testing, use ngrok:
```bash
npx ngrok http 3000
# Copy the https URL, e.g. https://abc123.ngrok.io
# Set Twilio webhook to: https://abc123.ngrok.io/api/webhook/twilio
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/webhook/twilio/route.ts src/bot/handlers.ts tests/api/webhook-twilio.test.ts
git commit -m "feat: wire Twilio webhook to bot state machine"
```
