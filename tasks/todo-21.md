# Task 21 — Razorpay Webhook Handler

**Phase:** 4 — Payments  
**Goal:** Handle Razorpay's `payment_link.paid` webhook event. Verify the signature, find the order by payment link ID, and mark it PAID.

**Files created:**
- `src/app/api/webhook/razorpay/route.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/api/webhook-razorpay.test.ts`:

```typescript
import { POST } from '@/app/api/webhook/razorpay/route'
import crypto from 'crypto'

const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()
const mockMessageCreate = vi.fn().mockResolvedValue({})
const mockSendWhatsApp = vi.fn().mockResolvedValue('SM123')

vi.mock('@/lib/db', () => ({
  db: {
    order: { findFirst: mockFindFirst, update: mockUpdate },
    message: { create: mockMessageCreate },
  },
}))
vi.mock('@/lib/twilio', () => ({ sendWhatsApp: mockSendWhatsApp }))

const WEBHOOK_SECRET = 'test-webhook-secret'

function makeSignedRequest(body: object): Request {
  const bodyStr = JSON.stringify(body)
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(bodyStr)
    .digest('hex')

  return new Request('http://localhost/api/webhook/razorpay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: bodyStr,
  })
}

describe('POST /api/webhook/razorpay', () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
    mockFindFirst.mockClear()
    mockUpdate.mockClear()
    mockSendWhatsApp.mockClear()
  })

  it('marks order as PAID on payment_link.paid event', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'order-1',
      customerPhone: '+911234567890',
      status: 'ACCEPTED',
    })
    mockUpdate.mockResolvedValue({ id: 'order-1', status: 'PAID' })

    const payload = {
      event: 'payment_link.paid',
      payload: {
        payment_link: { entity: { id: 'plink_test123' } },
      },
    }
    const res = await POST(makeSignedRequest(payload))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PAID' } })
    )
    expect(mockSendWhatsApp).toHaveBeenCalledWith(
      '+911234567890',
      expect.stringContaining('Payment received')
    )
  })

  it('returns 400 for invalid signature', async () => {
    const req = new Request('http://localhost/api/webhook/razorpay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'bad' },
      body: JSON.stringify({ event: 'payment_link.paid' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('ignores non-payment events', async () => {
    const payload = { event: 'refund.created', payload: {} }
    const res = await POST(makeSignedRequest(payload))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
npm test tests/api/webhook-razorpay.test.ts
```

Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Write `src/app/api/webhook/razorpay/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/twilio'
import { paymentReceivedMessage } from '@/bot/messages'

function verifyRazorpaySignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  if (!verifyRazorpaySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)

  if (event.event !== 'payment_link.paid') {
    return NextResponse.json({ ok: true })
  }

  const paymentLinkId = event.payload?.payment_link?.entity?.id
  if (!paymentLinkId) return NextResponse.json({ ok: true })

  const order = await db.order.findFirst({
    where: { paymentLinkId },
  })

  if (!order || order.status !== 'ACCEPTED') {
    return NextResponse.json({ ok: true })
  }

  await db.order.update({
    where: { id: order.id },
    data: { status: 'PAID' },
  })

  const msg = paymentReceivedMessage()
  await sendWhatsApp(order.customerPhone, msg)
  await db.message.create({
    data: {
      customerPhone: order.customerPhone,
      body: msg,
      direction: 'OUT',
      orderId: order.id,
    },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/api/webhook-razorpay.test.ts
```

Expected: `3 passed`.

- [ ] **Step 5: Configure Razorpay webhook**

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com) → Settings → Webhooks
2. Add webhook URL: `https://YOUR-DEPLOYMENT.vercel.app/api/webhook/razorpay`
3. Select event: `payment_link.paid`
4. Set the secret — copy and set as `RAZORPAY_WEBHOOK_SECRET` in Vercel env vars

For local testing, use ngrok and add `http://YOUR-NGROK-URL/api/webhook/razorpay` as the webhook URL (or test manually with the Razorpay test dashboard).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/webhook/razorpay/route.ts tests/api/webhook-razorpay.test.ts
git commit -m "feat: Razorpay webhook handler marks order PAID on payment"
```
