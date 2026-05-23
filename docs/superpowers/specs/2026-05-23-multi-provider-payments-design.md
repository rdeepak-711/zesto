# Multi-Provider Payment Integration Design

**Date:** 2026-05-23  
**Status:** Approved

---

## Goal

Support Stripe (UK/US tenants) and direct UPI (India tenants) alongside existing Razorpay, so operators can route payments through the right provider per tenant — eliminating gateway fees for UPI transactions and unblocking international tenants.

---

## Routing Model

Currency is display-only (`formatPrice`). **Payment routing is driven entirely by four boolean flags on `Tenant`:**

| Flag | Default | Meaning |
|------|---------|---------|
| `stripeEnabled` | `false` | Stripe Hosted Checkout is available |
| `razorpayEnabled` | `true` | Razorpay checkout page is available |
| `upiEnabled` | `false` | Direct UPI flow (UTR capture) is available |
| `codEnabled` | `true` | Cash on Delivery is available |

Multiple flags can be `true` simultaneously. When multiple online methods are enabled, the customer picks during ordering. **Stripe is the exception** — if `stripeEnabled=true`, the payment method screen is skipped entirely and Stripe is the only online path.

Customer-facing menu order when multiple India methods enabled: UPI first (no fee), Razorpay, COD.

---

## Schema Changes

### `Tenant` — new columns

```prisma
stripePublishableKey  String?  @db.VarChar(200)
stripeSecretKey       String?  @db.VarChar(200)
upiId                 String?  @db.VarChar(100)   // e.g. "baker@okicici"
stripeEnabled         Boolean  @default(false)
razorpayEnabled       Boolean  @default(true)
upiEnabled            Boolean  @default(false)
codEnabled            Boolean  @default(true)
```

`stripeSecretKey` is never returned in GET responses (same pattern as `razorpayKeySecret`).

### `Order` — new column

```prisma
upiTransactionId  String?  @db.VarChar(100)   // UTR from customer
```

### Migration

```bash
npx prisma migrate dev --name add-multi-provider-payment-fields
```

---

## Payment Flows

### Stripe (UK/US)

1. Customer confirms order in bot → `ORDER_PENDING`
2. Baker accepts (WhatsApp `accept <id>` or dashboard)
3. Baker accept handler calls `POST /api/payment/stripe-session` → creates Stripe Checkout Session → sends URL to customer via WhatsApp
4. Customer clicks URL → pays on stripe.com
5. Stripe webhook (`checkout.session.completed`) hits `POST /api/payment/stripe-webhook` → order marked `PAID` → WhatsApp notifications to customer and baker
6. Stripe redirects customer to `/pay/:orderId/success` (simple confirmation page)

### Direct UPI (India)

1. Customer selects UPI during ordering (`AWAITING_PAYMENT_METHOD`)
2. Order placed → `ORDER_PENDING`
3. Baker accepts → handler sends payment details to customer via WhatsApp:
   ```
   💳 Please pay ₹X to:
   UPI ID: {upiId}
   
   Reply with your UTR number once paid (e.g. 317524112345)
   ```
4. Baker accept handler sets customer bot session state to `AWAITING_UPI_UTR`
5. Customer replies with UTR → bot validates format (10–22 alphanumeric chars) → stores as `order.upiTransactionId` → notifies baker:
   ```
   ✅ Payment UTR received: 317524112345. Please verify in your UPI app and confirm.
   ```
6. Baker confirms via WhatsApp `confirm <id>` or dashboard "Mark Paid" → order `PAID` → customer notified

### Razorpay (India, unchanged)

Existing flow. `/pay/:orderId` page with Razorpay checkout. No changes.

---

## FSM Changes

### `BotInput` additions

```typescript
upiId?: string         // from tenant.upiId (only when upiEnabled)
hasRazorpay?: boolean  // from tenant.razorpayEnabled
// stripeEnabled never reaches FSM — webhook handler routes away before FSM
```

### `AWAITING_PAYMENT_METHOD` — updated menu

| Tenant config | Options shown |
|--------------|---------------|
| UPI + Razorpay + COD | `1. UPI (no extra charges)  2. Card/Netbanking  3. Cash on Delivery` |
| UPI + COD only | `1. UPI  2. Cash on Delivery` |
| Razorpay + COD only | `1. Online (Card/Netbanking)  2. Cash on Delivery` (existing) |
| `stripeEnabled=true` | State skipped — straight to `ORDER_PENDING` |

### New state: `AWAITING_UPI_UTR`

Added to `BotState` union. Handled **outside the FSM** (in the webhook handler, same pattern as the feedback rating intercept) to avoid giving the FSM DB access.

While in `AWAITING_UPI_UTR`:
- Message matches UTR pattern (`/^[A-Z0-9]{10,22}$/i`) → store on order, notify baker, reply "Thanks! We've notified the baker."
- Anything else → "Please reply with your UPI transaction reference (UTR) to confirm payment."

Session stays in `AWAITING_UPI_UTR` until UTR received. Staleness threshold: 2 hours (same as `ORDER_PENDING`).

---

## New Files

### `src/lib/payment/router.ts`

Pure functions, no DB access:

```typescript
export function requiresStripe(tenant: { stripeEnabled: boolean }): boolean
export function getIndiaPaymentMethods(tenant: { upiEnabled: boolean; razorpayEnabled: boolean; codEnabled: boolean }): ('upi' | 'razorpay' | 'cod')[]
```

### `src/lib/payment/stripe.ts`

```typescript
export async function createCheckoutSession(order: Order, tenant: Tenant): Promise<string>
// Returns the Stripe hosted checkout URL

export function constructWebhookEvent(body: string, signature: string): Stripe.Event
// Throws if signature invalid
```

Uses `stripe` npm package. Tenant's `stripeSecretKey` used for the session; `stripePublishableKey` is not needed server-side (Stripe Hosted Checkout needs no client-side key).

### `src/app/api/payment/stripe-session/route.ts`

`POST { orderId }` — authenticated via JWT cookie (dashboard use: baker clicks "Resend payment link"). The baker **accept** handler calls `createCheckoutSession()` directly as an imported function, not via this route. This route exists for dashboard-triggered resends only.

Creates Checkout Session with:
- `line_items`: order items summary + total
- `mode: 'payment'`
- `success_url: ${APP_URL}/pay/${orderId}/success`
- `cancel_url: ${APP_URL}/pay/${orderId}`
- `metadata: { zesto_order_id: orderId }`

### `src/app/api/payment/stripe-webhook/route.ts`

Handles `checkout.session.completed`:
1. Verify Stripe webhook signature using `STRIPE_WEBHOOK_SECRET` env var
2. Read `metadata.zesto_order_id`
3. Mark order `PAID`
4. Send WhatsApp to customer + baker
5. Return `{ ok: true }`

Uses `raw` body (must disable Next.js body parsing for this route).

### `src/app/pay/[orderId]/success/page.tsx`

Static page: "Payment received! The baker will be in touch shortly." No DB calls needed — Stripe already fired the webhook.

---

## Modified Files

### `prisma/schema.prisma`

Add columns as specified in Schema Changes section.

### `src/app/api/webhook/whatsapp/route.ts`

Baker accept handler (`handleOwnerReply`) — after `db.order.update` to ACCEPTED:

```typescript
if (requiresStripe(tenant)) {
  // Create Stripe session, send URL to customer via WhatsApp
} else if (tenant.upiEnabled && order.paymentMethod === 'UPI') {
  // Send UPI payment details to customer
  // Set customer bot session to AWAITING_UPI_UTR
} else {
  // Existing Razorpay payment link flow
}
```

Add `AWAITING_UPI_UTR` intercept (before FSM, after feedback intercept):
```typescript
if (session.state === 'AWAITING_UPI_UTR') {
  // Handle UTR capture
}
```

### `src/lib/bot/fsm.ts`

- Add `AWAITING_UPI_UTR` to `BotState` union
- Add `upiId?: string`, `hasRazorpay?: boolean` to `BotInput`
- Update `AWAITING_PAYMENT_METHOD` handler to use new fields

### `src/app/api/settings/route.ts`

Add to accepted PATCH fields:
- `stripePublishableKey`, `stripeSecretKey`, `upiId` (string fields, same null-guard as other keys)
- `stripeEnabled`, `razorpayEnabled`, `upiEnabled`, `codEnabled` (boolean fields)

Never return `stripeSecretKey` in GET response.

### `prisma/bootstrapTenant.ts`

No changes needed — new boolean columns have correct defaults in schema.

---

## Environment Variables

```bash
# Stripe (platform-level, for webhook verification)
STRIPE_WEBHOOK_SECRET=whsec_...

# Per-tenant Stripe keys stored in DB (stripePublishableKey, stripeSecretKey)
# No platform-level Stripe key needed — each tenant uses their own
```

---

## Dashboard Settings UI

New **Payments** section in `/dashboard/settings`:

- **Stripe** group: Publishable Key input, Secret Key input, `stripeEnabled` toggle — always visible
- **Razorpay** group: existing Key ID + Secret fields, new `razorpayEnabled` toggle
- **UPI** group: UPI ID input (placeholder: `yourname@bank`), `upiEnabled` toggle
- **COD** group: `codEnabled` toggle

Secret fields (`stripeSecretKey`, `razorpayKeySecret`) show as password inputs, masked by default.

---

## Testing

### Unit tests

- `tests/unit/payment-router.test.ts` — `requiresStripe` and `getIndiaPaymentMethods` pure function tests
- `tests/unit/utr-validation.test.ts` — UTR pattern matching (valid 12-digit UTR, invalid short strings, letter-only strings)
- `tests/unit/fsm-payment-methods.test.ts` — FSM `AWAITING_PAYMENT_METHOD` with upiId/hasRazorpay permutations

### Manual smoke tests

- India tenant, UPI only: order → `AWAITING_PAYMENT_METHOD` shows UPI + COD only
- India tenant, UPI + Razorpay: order → all three options shown
- India tenant, Stripe enabled: order → no payment method screen, straight to `ORDER_PENDING`
- UPI flow end-to-end: accept order → UPI details sent → customer replies UTR → baker gets notification → `confirm` → `PAID`
- Stripe flow end-to-end: accept order → Stripe URL sent → simulate Stripe webhook → order `PAID`

---

## Out of Scope

- Stripe Connect (platform takes a cut) — not needed, operator manages each tenant's keys directly
- Stripe Payment Element embedded in `/pay/:orderId` — using Hosted Checkout instead
- UPI QR code image generation — UPI ID as text is sufficient; customers copy-paste into their UPI app
- Automated UPI payment verification (no API for this without a gateway)
- Refunds via Stripe/Razorpay — handle manually for now
