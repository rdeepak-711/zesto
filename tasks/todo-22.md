# Task 22 — Payment Confirmation Message to Customer

**Phase:** 4 — Payments  
**Goal:** After the Razorpay webhook confirms payment, the customer receives a friendly confirmation via WhatsApp. Verify the full payment flow end-to-end.

**Note:** The message send itself was already wired in Task 21. This task adds a dedicated test and performs the full manual E2E verification.

**Files created:**
- `tests/api/payment-flow.test.ts`

---

- [ ] **Step 1: Write integration test for the full payment flow**

Create `tests/api/payment-flow.test.ts`:

```typescript
import { paymentReceivedMessage, paymentLinkMessage } from '@/bot/messages'
import { formatCurrency } from '@/bot/messages'

describe('payment messages', () => {
  it('paymentLinkMessage contains the URL and amount', () => {
    const msg = paymentLinkMessage('https://rzp.io/l/abc123', 80000)
    expect(msg).toContain('https://rzp.io/l/abc123')
    expect(msg).toContain('₹800')
  })

  it('paymentReceivedMessage contains confirmation text', () => {
    const msg = paymentReceivedMessage()
    expect(msg).toContain('Payment received')
  })

  it('formatCurrency converts paise to rupees', () => {
    expect(formatCurrency(100000)).toBe('₹1000')
    expect(formatCurrency(8000)).toBe('₹80')
    expect(formatCurrency(50)).toBe('₹0')
  })
})
```

- [ ] **Step 2: Run to verify tests pass**

```bash
npm test tests/api/payment-flow.test.ts
```

Expected: `3 passed`.

- [ ] **Step 3: Full end-to-end payment flow test**

This is a manual walkthrough of the complete flow. Do it once to verify everything works before moving to Phase 5.

**Prerequisites:**
- Dev server running with ngrok
- Twilio webhook set to ngrok URL
- Razorpay webhook set to ngrok URL
- Razorpay in test mode (`rzp_test_*` keys)

**Steps:**
1. Send "Hi" to the bakery WhatsApp number
2. Order 1x Chocolate Fudge Cake (₹800)
3. Confirm the order
4. Baker receives notification on WhatsApp
5. Baker replies "1" to accept
6. Customer receives payment link: `https://rzp.io/l/...`
7. Open the payment link in a browser
8. Complete payment using Razorpay test card: `4111 1111 1111 1111`, any future expiry, any CVV
9. Customer receives: "💚 Payment received! Your order is confirmed..."
10. Open dashboard at `http://localhost:3000/orders` — order status shows PAID

If any step fails:
- Step 4 fails: Check `BAKER_PHONE` env var and Twilio sandbox settings
- Step 6 fails: Check Razorpay key and `createPaymentLink` — look at Razorpay dashboard for errors
- Step 9 fails: Check `RAZORPAY_WEBHOOK_SECRET` and ngrok URL in Razorpay webhook settings

- [ ] **Step 4: Deploy Phase 4 to Vercel**

```bash
vercel --prod
```

Verify the production health check:
```bash
curl https://YOUR-DEPLOYMENT.vercel.app/api/health
```

Expected: `{"status":"ok","db":"connected"}`

Update your Razorpay and Twilio webhooks to point at the production URL.

- [ ] **Step 5: Commit**

```bash
git add tests/api/payment-flow.test.ts
git commit -m "test: add payment message tests + complete Phase 4 E2E verification"
```
