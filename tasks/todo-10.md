# Task 10 — Baker Reply Handling (ACCEPT/REJECT via WhatsApp)

**Phase:** 2 — WhatsApp Bot  
**Goal:** When the baker replies "1" or "2" to a notification message, the system accepts or rejects the order. This logic runs inside the same Twilio webhook — we detect that the sender is the baker's phone and route accordingly.

**Files modified:**
- `src/app/api/webhook/twilio/route.ts`
- `src/bot/handlers.ts`

**Files created:**
- `tests/bot/baker-reply.test.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/bot/baker-reply.test.ts`:

```typescript
import { handleBakerReply } from '@/bot/handlers'

const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()
const mockSendWhatsApp = vi.fn().mockResolvedValue('SM123')

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
    message: { create: vi.fn().mockResolvedValue({}) },
  },
}))
vi.mock('@/lib/twilio', () => ({
  sendWhatsApp: mockSendWhatsApp,
}))

describe('handleBakerReply', () => {
  const pendingOrder = {
    id: 'order-1',
    customerPhone: '+911234567890',
    totalAmount: 80000,
    status: 'PENDING',
    items: [{ name: 'Choc Cake', quantity: 1, price: 80000, id: 'oi-1', orderId: 'order-1', menuItemId: 'item-1' }],
  }

  beforeEach(() => {
    mockFindFirst.mockClear()
    mockUpdate.mockClear()
    mockSendWhatsApp.mockClear()
  })

  it('reply "1" accepts the oldest pending order', async () => {
    mockFindFirst.mockResolvedValue(pendingOrder)
    mockUpdate.mockResolvedValue({ ...pendingOrder, status: 'ACCEPTED' })

    const result = await handleBakerReply('1')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      })
    )
    expect(result.action).toBe('accepted')
    expect(result.orderId).toBe('order-1')
  })

  it('reply "2" rejects the oldest pending order', async () => {
    mockFindFirst.mockResolvedValue(pendingOrder)
    mockUpdate.mockResolvedValue({ ...pendingOrder, status: 'REJECTED' })

    const result = await handleBakerReply('2')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' }),
      })
    )
    expect(result.action).toBe('rejected')

    // Notifies customer of rejection
    expect(mockSendWhatsApp).toHaveBeenCalledWith(
      '+911234567890',
      expect.stringContaining("couldn't accept")
    )
  })

  it('returns no-pending-order if no PENDING order found', async () => {
    mockFindFirst.mockResolvedValue(null)
    const result = await handleBakerReply('1')
    expect(result.action).toBe('no-pending-order')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('ignores unknown replies', async () => {
    const result = await handleBakerReply('hello')
    expect(result.action).toBe('ignored')
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
npm test tests/bot/baker-reply.test.ts
```

Expected: FAIL — `handleBakerReply is not exported from '@/bot/handlers'`

- [ ] **Step 3: Add `handleBakerReply` to `src/bot/handlers.ts`**

Add this function to the end of `src/bot/handlers.ts`:

```typescript
import { db } from '@/lib/db'
import { orderRejectedMessage } from './messages'

type BakerReplyResult =
  | { action: 'accepted'; orderId: string }
  | { action: 'rejected'; orderId: string }
  | { action: 'no-pending-order' }
  | { action: 'ignored' }

export async function handleBakerReply(input: string): Promise<BakerReplyResult> {
  const normalized = input.trim()

  if (normalized !== '1' && normalized !== '2') {
    return { action: 'ignored' }
  }

  // Find the oldest PENDING order
  const order = await db.order.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
  })

  if (!order) return { action: 'no-pending-order' }

  if (normalized === '1') {
    await db.order.update({
      where: { id: order.id },
      data: { status: 'ACCEPTED' },
    })
    // Payment link is sent by Task 20 (Razorpay). For now just return.
    return { action: 'accepted', orderId: order.id }
  } else {
    await db.order.update({
      where: { id: order.id },
      data: { status: 'REJECTED' },
    })
    // Notify customer
    await sendWhatsApp(order.customerPhone, orderRejectedMessage())
    await db.message.create({
      data: {
        customerPhone: order.customerPhone,
        body: orderRejectedMessage(),
        direction: 'OUT',
        orderId: order.id,
      },
    })
    return { action: 'rejected', orderId: order.id }
  }
}
```

- [ ] **Step 4: Update `src/app/api/webhook/twilio/route.ts` to detect baker replies**

At the top of the `POST` function, add baker detection before the bot state machine logic:

```typescript
// Inside POST, after parsing formData:

const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })
const bakerPhone = config?.bakerPhone

// Check if this message is from the baker
const isBakerMessage = bakerPhone && customerPhone === bakerPhone
if (isBakerMessage) {
  const result = await handleBakerReply(body)
  // Acknowledge to baker
  if (result.action === 'accepted') {
    await sendWhatsApp(customerPhone, `✅ Order ${result.orderId.slice(0, 8)} accepted! Sending payment link to customer...`)
  } else if (result.action === 'rejected') {
    await sendWhatsApp(customerPhone, `❌ Order rejected. Customer has been notified.`)
  } else if (result.action === 'no-pending-order') {
    await sendWhatsApp(customerPhone, `No pending orders found.`)
  }
  return NextResponse.json({ ok: true })
}
// ... rest of bot logic continues unchanged
```

Import `handleBakerReply` at the top of the file:
```typescript
import { notifyBaker, handleBakerReply } from '@/bot/handlers'
```

- [ ] **Step 5: Run all bot tests together**

```bash
npm test tests/bot/
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/bot/handlers.ts src/app/api/webhook/twilio/route.ts tests/bot/baker-reply.test.ts
git commit -m "feat: baker can accept/reject orders by replying 1/2 on WhatsApp"
```
