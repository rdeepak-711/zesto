# Task 19 — Razorpay Client + createPaymentLink

**Phase:** 4 — Payments  
**Goal:** Thin Razorpay wrapper that creates a payment link for an order amount and returns a short URL to send to the customer.

**Files created:**
- `src/lib/razorpay.ts`
- `tests/api/razorpay.test.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/api/razorpay.test.ts`:

```typescript
import { createPaymentLink } from '@/lib/razorpay'

const mockPaymentLinks = {
  create: vi.fn().mockResolvedValue({
    id: 'plink_test123',
    short_url: 'https://rzp.io/l/test123',
  }),
}

vi.mock('razorpay', () => ({
  default: vi.fn(() => ({
    paymentLink: mockPaymentLinks,
  })),
}))

describe('createPaymentLink', () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_xxx'
    process.env.RAZORPAY_KEY_SECRET = 'secret'
    mockPaymentLinks.create.mockClear()
  })

  it('creates a payment link with correct amount and description', async () => {
    const result = await createPaymentLink({
      orderId: 'order-1',
      amount: 80000,
      customerPhone: '+911234567890',
      description: 'Chocolate Fudge Cake (1kg) x1',
    })

    expect(mockPaymentLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 80000,
        currency: 'INR',
        description: 'Chocolate Fudge Cake (1kg) x1',
      })
    )
    expect(result.id).toBe('plink_test123')
    expect(result.url).toBe('https://rzp.io/l/test123')
  })

  it('includes order reference in notes', async () => {
    await createPaymentLink({
      orderId: 'order-abc',
      amount: 50000,
      customerPhone: '+911234567890',
      description: 'Test',
    })

    expect(mockPaymentLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: expect.objectContaining({ orderId: 'order-abc' }),
      })
    )
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
npm test tests/api/razorpay.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/razorpay'`

- [ ] **Step 3: Write `src/lib/razorpay.ts`**

```typescript
import Razorpay from 'razorpay'

function getClient() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  })
}

interface CreatePaymentLinkOptions {
  orderId: string
  amount: number // in paise
  customerPhone: string
  description: string
}

interface PaymentLinkResult {
  id: string
  url: string
}

export async function createPaymentLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
  const client = getClient()

  const link = await client.paymentLink.create({
    amount: opts.amount,
    currency: 'INR',
    description: opts.description,
    customer: {
      contact: opts.customerPhone,
    },
    notes: {
      orderId: opts.orderId,
    },
    notify: {
      sms: false,  // We send via WhatsApp ourselves
      email: false,
    },
    reminder_enable: false,
  })

  return {
    id: link.id as string,
    url: link.short_url as string,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/api/razorpay.test.ts
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/razorpay.ts tests/api/razorpay.test.ts
git commit -m "feat: add Razorpay createPaymentLink helper"
```
