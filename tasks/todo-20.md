# Task 20 — Order Accept API (Razorpay Link → WhatsApp)

**Phase:** 4 — Payments  
**Goal:** When baker accepts an order (from dashboard or WhatsApp), automatically create a Razorpay payment link and send it to the customer via WhatsApp.

**Files modified:**
- `src/app/api/orders/[id]/accept/route.ts`
- `src/bot/handlers.ts`

---

- [ ] **Step 1: Update `src/app/api/orders/[id]/accept/route.ts`**

Replace the entire file with the payment-link version:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createPaymentLink } from '@/lib/razorpay'
import { sendWhatsApp } from '@/lib/twilio'
import { paymentLinkMessage } from '@/bot/messages'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const order = await db.order.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 'PENDING') {
    return NextResponse.json({ error: 'Order is not pending' }, { status: 409 })
  }

  // Generate Razorpay payment link
  const description = order.items
    .map((i) => `${i.name} x${i.quantity}`)
    .join(', ')

  const paymentLink = await createPaymentLink({
    orderId: order.id,
    amount: order.totalAmount,
    customerPhone: order.customerPhone,
    description,
  })

  // Mark order as ACCEPTED and save payment link
  const updated = await db.order.update({
    where: { id },
    data: {
      status: 'ACCEPTED',
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
    },
  })

  // Send payment link to customer via WhatsApp
  const msg = paymentLinkMessage(paymentLink.url, order.totalAmount)
  await sendWhatsApp(order.customerPhone, msg)
  await db.message.create({
    data: {
      customerPhone: order.customerPhone,
      body: msg,
      direction: 'OUT',
      orderId: order.id,
    },
  })

  return NextResponse.json({ order: updated, paymentLink })
}
```

- [ ] **Step 2: Update baker WhatsApp reply handler to send payment link**

In `src/bot/handlers.ts`, replace the `handleBakerReply` accept block so it also triggers the payment flow:

```typescript
// In handleBakerReply, replace the '1' block:
if (normalized === '1') {
  // Trigger the same logic as the API route
  const { createPaymentLink } = await import('@/lib/razorpay')
  const { paymentLinkMessage } = await import('./messages')

  const description = order.items.map((i: { name: string; quantity: number }) => `${i.name} x${i.quantity}`).join(', ')

  const paymentLink = await createPaymentLink({
    orderId: order.id,
    amount: order.totalAmount,
    customerPhone: order.customerPhone,
    description,
  })

  await db.order.update({
    where: { id: order.id },
    data: {
      status: 'ACCEPTED',
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
    },
  })

  const msg = paymentLinkMessage(paymentLink.url, order.totalAmount)
  await sendWhatsApp(order.customerPhone, msg)
  await db.message.create({
    data: { customerPhone: order.customerPhone, body: msg, direction: 'OUT', orderId: order.id },
  })

  return { action: 'accepted', orderId: order.id }
}
```

- [ ] **Step 3: Manual end-to-end test**

1. Send a full order via WhatsApp (go through the full bot flow from Task 08)
2. When you receive the baker notification, reply "1"
3. Expected: You see "✅ Order accepted!" on the baker's phone
4. Expected: Customer receives the Razorpay payment link via WhatsApp
5. Open the link in a browser — expected: Razorpay payment page with the correct amount

For dashboard flow:
1. Go to `http://localhost:3000/orders`
2. Find a PENDING order, click Accept
3. Expected: Order status changes to ACCEPTED
4. Customer receives payment link on WhatsApp

- [ ] **Step 4: Commit**

```bash
git add src/app/api/orders/[id]/accept/route.ts src/bot/handlers.ts
git commit -m "feat: auto-send Razorpay payment link to customer when order is accepted"
```
