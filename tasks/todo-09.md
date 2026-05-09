# Task 09 — Baker Notification on New Order

**Phase:** 2 — WhatsApp Bot  
**Goal:** Verify the baker notification message is correctly formatted and sent. The `notifyBaker` function was written in Task 08 — this task adds dedicated tests for it.

**Files created:**
- `tests/bot/handlers.test.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/bot/handlers.test.ts`:

```typescript
import { notifyBaker } from '@/bot/handlers'
import type { CartItem } from '@/types'

const mockSendWhatsApp = vi.fn().mockResolvedValue('SM123')

vi.mock('@/lib/twilio', () => ({
  sendWhatsApp: mockSendWhatsApp,
}))

const sampleCart: CartItem[] = [
  { menuItemId: 'item-1', name: 'Chocolate Fudge Cake (1kg)', price: 80000, quantity: 1 },
  { menuItemId: 'item-2', name: 'Butter Croissant', price: 8000, quantity: 3 },
]

describe('notifyBaker', () => {
  beforeEach(() => mockSendWhatsApp.mockClear())

  it('sends a WhatsApp to the baker phone', async () => {
    await notifyBaker('+910000000001', 'order-abc', sampleCart, 104000, '+911234567890')
    expect(mockSendWhatsApp).toHaveBeenCalledOnce()
    expect(mockSendWhatsApp.mock.calls[0][0]).toBe('+910000000001')
  })

  it('includes order items in the message', async () => {
    await notifyBaker('+910000000001', 'order-abc', sampleCart, 104000, '+911234567890')
    const msg: string = mockSendWhatsApp.mock.calls[0][1]
    expect(msg).toContain('Chocolate Fudge Cake')
    expect(msg).toContain('Butter Croissant')
    expect(msg).toContain('3x')
  })

  it('includes the total amount in the message', async () => {
    await notifyBaker('+910000000001', 'order-abc', sampleCart, 104000, '+911234567890')
    const msg: string = mockSendWhatsApp.mock.calls[0][1]
    expect(msg).toContain('₹1040')
  })

  it('includes accept/reject instructions', async () => {
    await notifyBaker('+910000000001', 'order-abc', sampleCart, 104000, '+911234567890')
    const msg: string = mockSendWhatsApp.mock.calls[0][1]
    expect(msg).toContain('1')
    expect(msg).toContain('2')
    expect(msg).toContain('order-abc')
  })

  it('includes the customer phone number', async () => {
    await notifyBaker('+910000000001', 'order-abc', sampleCart, 104000, '+911234567890')
    const msg: string = mockSendWhatsApp.mock.calls[0][1]
    expect(msg).toContain('+911234567890')
  })
})
```

- [ ] **Step 2: Run to verify test status**

```bash
npm test tests/bot/handlers.test.ts
```

Expected: All 5 tests pass (the function was already written in Task 08). If any fail, check `src/bot/handlers.ts`.

- [ ] **Step 3: Manual end-to-end test**

With the dev server running and your Twilio webhook pointed at ngrok (Task 08 Step 6):

1. Open WhatsApp and send "Hi" to your Twilio sandbox number
2. Expected: Bot replies with category list (Cakes, Pastries, Cookies)
3. Reply "1" → Expected: Cake items listed
4. Reply "1" → Expected: "How many Chocolate Fudge Cake?"
5. Reply "2" → Expected: "Added 2x Chocolate Fudge Cake..."
6. Reply "no" → Expected: Order summary with total
7. Reply "yes" → Expected: "Order placed! The baker will review..."
8. Check the baker's phone — expected: notification with order details and "Reply 1/2"

If the baker notification doesn't arrive, check:
- `TWILIO_WHATSAPP_NUMBER` is set in `.env.local`
- `BAKER_PHONE` is set in `.env.local`
- Twilio account has WhatsApp sandbox active

- [ ] **Step 4: Commit**

```bash
git add tests/bot/handlers.test.ts
git commit -m "test: add baker notification unit tests"
```
