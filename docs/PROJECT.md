# Zesto — Project Documentation

## What Is Zesto?

Zesto is a multi-tenant WhatsApp ordering SaaS. Multiple businesses — bakeries, restaurants, grocers, cafés — each get their own WhatsApp number, isolated menu and orders, and a dedicated owner dashboard. Customers chat with a bot to browse the menu and place orders. The owner gets notified on WhatsApp and manages everything from a web dashboard.

The system runs entirely on existing tools customers already have — WhatsApp — with no app downloads, no accounts, and no friction. A single Zesto deployment hosts many tenants through shared-DB multi-tenancy with `tenantId` on every table.

---

## How It Works (End to End)

### Customer Side

1. Customer sends "hi" to the **business's WhatsApp number**
2. Twilio routes the message to `/api/webhook/whatsapp` with a `To` field matching that WA number
3. Webhook looks up the tenant by `whatsappNumber`, loads their menu and bot messages
4. Bot responds with the menu categories
5. Customer browses items, picks quantities, adds to cart
6. Bot asks for delivery date, applies any discount code, shows order summary
7. Customer confirms — order is created under `tenantId`
8. If the owner requests payment, customer gets a link to pay online
9. Once the order is ready, customer gets a WhatsApp notification and a prompt for a star rating

### Owner Side

1. Owner receives a WhatsApp notification with order details when a new order arrives
2. Owner types `orders` to open the interactive order manager (on their WA number)
3. Bot shows a paginated list of their own tenant's active orders (5 at a time)
4. Owner replies with a number to select an order and sees full detail + numbered actions
5. For PENDING: Accept or Reject. For ACCEPTED: Request Payment, Reject, or Mark Completed. For PAID: Mark Completed.
6. Each action notifies the customer automatically
7. Customer gets a completion message and a 1–5 feedback prompt

### Dashboard

The owner also has a full web dashboard at `/dashboard`. Login is via WhatsApp OTP to their registered phone. JWT payload includes `{ phone, tenantId, role: 'owner' }` — every dashboard query is scoped to `tenantId`.

---

## Multi-Tenancy Model

**Routing** — every Twilio webhook includes a `To` field (the WA number the message was sent to). The webhook handler strips `whatsapp:` and does:
```ts
const tenant = await db.tenant.findUnique({ where: { whatsappNumber: toNumber } })
```
All subsequent queries are scoped to `tenant.id`.

**Auth** — OTP login finds the tenant by `ownerPhone`:
```ts
const tenant = await db.tenant.findFirst({ where: { ownerPhone: phone, active: true } })
```
JWT is signed with `{ phone, tenantId, role: 'owner' }`. Every dashboard server component calls `getAuthFromCookies()` to extract `tenantId`.

**Data isolation** — every table that holds business data (`orders`, `menu_categories`, `menu_items`, `bot_sessions`, `bot_messages`, `bot_rules`, `broadcasts`, `messages`, `discount_codes`, `order_feedback`, `otp_sessions`) has a `tenantId` column indexed and included in every query `WHERE` clause.

**Mutation security** — all CRUD API routes (`PATCH`/`DELETE` on bot-rules, bot-messages, discounts, menu categories, menu items) verify the session cookie and use `updateMany`/`deleteMany` with `{ id, tenantId }` — a tenant A owner hitting a tenant B resource ID gets 404, not a silent cross-tenant write.

---

## Architecture

```
Customer (WhatsApp)
       │
       ▼
  Twilio — To: whatsapp:+<tenantWANumber>
       │
       ▼
POST /api/webhook/whatsapp
       │
       ├─ db.tenant.findUnique({ whatsappNumber })   ← tenant routing
       │
       ├─ Owner handler (stateful: orders → list → detail → action)
       │
       ├─ Pre-FSM handlers (track, cancel order, 1–5 feedback)
       │
       └─ Bot FSM (processMessage)  ← pure function, no DB access
              │
              └─ Webhook saves session (tenantId), creates order (tenantId)
                        │
                        ▼
                  Owner (WhatsApp) — ACCEPT / REJECT reply
                        │
                        ▼
              POST /api/webhook/whatsapp  (same route, owner path)
```

The bot is a **pure function** — it takes the current state + message as input and returns the reply + next state. It has no database access. All DB reads and writes happen in the webhook handler before and after calling the FSM.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | TiDB Cloud (MySQL) |
| ORM | Prisma 7 + `@tidbcloud/prisma-adapter` |
| Multi-tenancy | Shared DB, `tenantId` on every table |
| WhatsApp / SMS | Twilio |
| Payments | Razorpay Standard Checkout |
| Auth | JWT + httpOnly cookie (`{ phone, tenantId, role: 'owner' }`) |
| AI | OpenRouter (Gemini 2.0 Flash Lite) |
| Hosting | Vercel |
| Tests | Vitest (unit), Playwright (E2E) |

---

## Database Schema

### Tenants

**`tenants`** — one row per business
- `id` (UUID), `businessName`, `businessType` (bakery / restaurant / grocery / café / pharmacy / pet_store / florist / general)
- `ownerPhone` (unique — used for OTP login resolution)
- `whatsappNumber` (unique — Twilio `To` field for routing)
- `minOrderAmount`, `address`, `logoUrl`
- `active` (bool — inactive tenants are silently ignored)
- `createdAt`

### Business Data (all have `tenantId`)

**`orders`** — one row per placed order
- `tenantId`, `customerPhone`, `customerName`, `status`
- `totalAmount` (paise), `discountCode`, `discountAmount`
- `deliveryNote`, `notes` (custom order description)
- `paymentLinkId` (Razorpay order ID), `paymentLinkUrl` (payment ID after success)
- `bakerNotifiedAt`, `createdAt`, `updatedAt`

**`order_items`** — line items per order
- `orderId`, `menuItemId`, `name`, `price`, `quantity`, `variantName`

**`menu_categories`** — e.g. Cakes, Pastries, Cookies
- `tenantId`, `name`, `sortOrder`, `active`, `isCustom`

**`menu_items`** — individual products
- `tenantId`, `categoryId`, `name`, `description`, `price`, `imageUrl`, `available`, `sortOrder`

**`menu_item_variants`** — size/flavour options per item
- `menuItemId`, `name`, `priceDelta` (added to base price)

**`bot_sessions`** — one row per active customer conversation
- Compound unique key: `(customerPhone, tenantId)`
- `state`, `cart` (JSON), `context` (JSON), `updatedAt`

**`bot_messages`** — all bot reply templates, editable from dashboard
- `key`, `tenantId`, `label`, `value`

**`bot_rules`** — custom keyword triggers, evaluated before FSM
- `tenantId`, `label`, `state`, `condition`, `matchText`, `reply`, `nextState`, `sortOrder`, `active`

**`messages`** — full conversation log (IN + OUT)
- `tenantId`, `customerPhone`, `body`, `direction`, `createdAt`

**`broadcasts`** — history of bulk WhatsApp messages sent
- `tenantId`, `message`, `sentCount`, `failedCount`, `createdAt`

**`discount_codes`** — promo codes
- `tenantId`, `code`, `type` (PERCENT / FLAT), `value`, `minAmount`
- `maxUses`, `usedCount`, `expiresAt`, `active`

**`order_feedback`** — post-order ratings
- `orderId`, `rating` (1–5), `createdAt`

**`otp_sessions`** — short-lived OTP storage
- `phone`, `tenantId`, `code`, `expiresAt`

---

## Bot State Machine

The FSM lives in `src/lib/bot/fsm.ts`. It is a pure function with no side effects.

### States

```
IDLE
  └─ user says hi / menu → AWAITING_CATEGORY

AWAITING_CATEGORY
  └─ valid number → AWAITING_ITEM
  └─ "custom" → AWAITING_CUSTOM_DESCRIPTION

AWAITING_ITEM
  └─ item has variants → AWAITING_VARIANT
  └─ item no variants → AWAITING_QUANTITY

AWAITING_VARIANT
  └─ valid choice → AWAITING_QUANTITY

AWAITING_QUANTITY
  └─ valid number → AWAITING_MORE

AWAITING_MORE
  └─ confirm → check min order → AWAITING_DELIVERY_DATE
  └─ number → AWAITING_ITEM (add more)
  └─ back → AWAITING_CATEGORY

AWAITING_DELIVERY_DATE
  └─ any text → AWAITING_CONFIRMATION (shows full summary + discount hint)

AWAITING_CONFIRMATION
  └─ yes → placeOrder = true → IDLE
  └─ cancel → IDLE
  └─ code → try discount → stay in AWAITING_CONFIRMATION
  └─ unknown → AWAITING_CONFIRMATION (re-prompt)

AWAITING_CUSTOM_DESCRIPTION
  └─ text (≥20 chars) → AWAITING_CUSTOM_CONFIRM

AWAITING_CUSTOM_CONFIRM
  └─ yes → placeOrder = true → IDLE
  └─ edit → AWAITING_CUSTOM_DESCRIPTION
```

### Pre-FSM Handlers (bypass FSM entirely)

These run before the FSM on every customer message:

- **Feedback** — if message is `1`–`5` and customer has a completed order without a rating, save feedback and reply. Done.
- **Track** — if message matches `track`, `status`, `my order`, etc., fetch active order and return status message. Done.
- **Cancel order** — if message is `cancel order`, cancel if PENDING, or notify owner if ACCEPTED/PAID. Done.

---

## Payment Flow (Razorpay)

```
Owner Dashboard
  └─ order ACCEPTED
  └─ click "💳 Request Payment"
        │
        ▼
  sendPaymentLink (server action)
        │
        ▼
  sendWhatsApp(customerPhone, "Pay here: /pay/[orderId]")

Customer opens /pay/[orderId] in browser
        │   (page shows tenant businessName, fetched via order.tenantId)
        ▼
  PayButton click → POST /api/payment/create-order
        │            (creates Razorpay order, stores rzp order ID)
        ▼
  Razorpay modal opens (UPI / card / netbanking)
        │
        ▼
  Customer pays → razorpay_payment_id + signature returned
        │
        ▼
  POST /api/payment/verify
        │   HMAC-SHA256(order_id|payment_id, KEY_SECRET)
        │   compare with razorpay_signature
        ▼
  Order status → PAID
        │
        ▼
  Owner sees PAID in dashboard → clicks "✓ Mark as Completed"
        │
        ▼
  Customer gets WhatsApp: "Order ready! Rate us 1–5"
```

---

## Auth Flow

The dashboard is protected by a JWT stored in an httpOnly cookie. The auth flow:

1. Owner visits `/login`, enters their phone number
2. Server finds tenant by `ownerPhone` → stores `tenantId` in the OTP session
3. Server sends a 6-digit OTP via WhatsApp to the owner
4. Owner enters OTP on the verify screen
5. Server validates OTP, retrieves `tenantId`, signs JWT `{ phone, tenantId, role: 'owner' }`, sets `zesto_auth` cookie
6. `src/proxy.ts` intercepts every `/dashboard` request and validates the JWT — redirects to `/login` if invalid or missing
7. Every dashboard server component calls `getAuthFromCookies()` and scopes all DB queries to `auth.tenantId`

---

## Key Files

```
src/
  proxy.ts                          Auth guard for /dashboard
  lib/
    bot/fsm.ts                      Bot state machine (pure function)
    botSession.ts                   Session read/write — compound key (phone, tenantId)
    auth.ts                         JWT sign/verify — AuthPayload: { phone, tenantId, role }
    otp.ts                          OTP generate/verify — stores + returns tenantId
    twilio.ts                       sendWhatsApp()
    razorpay.ts                     Razorpay client + signature verify
    bakerNotify.ts                  New order WhatsApp notification (uses tenant.ownerPhone)
    db.ts                           Prisma client singleton

  app/
    page.tsx                        Marketing landing page
    ContactForm.tsx                 Landing page contact form (client)

    api/
      webhook/whatsapp/route.ts     Main bot webhook — routes by To → tenant → FSM
      auth/send-otp/route.ts        Finds tenant by ownerPhone, sends OTP
      auth/verify-otp/route.ts      Verifies OTP, issues JWT with tenantId
      payment/create-order/route.ts Create Razorpay order
      payment/verify/route.ts       Verify payment signature
      broadcast/route.ts            Send WhatsApp to tenant's customers (tenantId scoped)
      discounts/[id]/route.ts       PATCH/DELETE — auth + tenantId guard
      menu/categories/[id]/route.ts PATCH/DELETE — auth + tenantId guard
      menu/items/[id]/route.ts      PATCH/DELETE — auth + tenantId guard
      bot-rules/[id]/route.ts       PATCH/DELETE — auth + tenantId guard
      bot-messages/[key]/route.ts   PATCH — auth + tenantId guard
      contact/route.ts              Landing page form → WhatsApp notify
      settings/route.ts             Tenant config update (tenantId from JWT)
      analytics/route.ts            Revenue + order analytics (tenantId scoped)

    pay/[orderId]/
      page.tsx                      Customer-facing payment page (shows tenant businessName)
      PayButton.tsx                 Razorpay checkout modal (client)

    dashboard/
      layout.tsx                    Auth check + sidebar (businessName from tenant)
      Sidebar.tsx                   Navigation sidebar (dynamic businessName)
      orders/[id]/
        page.tsx                    Order detail + accept/reject/complete (tenantId scoped)
        SendPaymentButton.tsx       Payment request button with toast
      conversations/[phone]/page.tsx  Per-customer message thread (tenantId scoped)
      customers/page.tsx            CRM — all customers with spend (tenantId scoped)
      broadcast/
        page.tsx + BroadcastManager.tsx  (tenantId scoped)
      discounts/
        page.tsx + DiscountManager.tsx   (tenantId scoped)
      menu/
        page.tsx + MenuManager.tsx  Menu + variants editor (tenantId scoped)
      analytics/page.tsx            Revenue charts (tenantId scoped)
      settings/
        page.tsx + SettingsForm.tsx  Reads/writes Tenant model

prisma/
  schema.prisma                     Full DB schema
  seed.ts                           Seed categories, items, bot messages
  backfill-tenant.ts                Creates first tenant from env vars

tests/
  unit/fsm.test.ts                  19 unit tests for bot FSM
```

---

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `DATABASE_URL` | Prisma | TiDB Cloud connection string |
| `JWT_SECRET` | Auth | Sign/verify session tokens |
| `TWILIO_ACCOUNT_SID` | Twilio | Account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio | API auth |
| `TWILIO_WHATSAPP_NUMBER` | Twilio + backfill | Sender number (`whatsapp:+1...`) — also used to populate first tenant's `whatsappNumber` |
| `NEXT_PUBLIC_APP_URL` | Payment links | Base URL for `/pay/[id]` links |
| `RAZORPAY_KEY_ID` | Razorpay (server) | API key for order creation |
| `RAZORPAY_KEY_SECRET` | Razorpay (server) | HMAC signature verification |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay (client) | Opens checkout modal |
| `OPENROUTER_API_KEY` | Webhook | AI reformat of custom orders (optional) |
| `UNSPLASH_ACCESS_KEY` | Menu manager | Image search (optional) |

Note: `BAKER_PHONE` is no longer used. Each tenant's owner phone is stored in the `tenants` table and resolved from the OTP login flow.

---

## Bot Message Templates

All bot reply text is stored in the `bot_messages` table per tenant and editable from the dashboard under **Bot Script**. Templates support placeholders:

| Placeholder | Replaced with |
|---|---|
| `{categories}` | Numbered list of menu categories |
| `{item}` | Selected item name |
| `{qty}` | Quantity |
| `{cart}` | Full cart summary |
| `{description}` | Custom order description |
| `{amount}` | Formatted rupee amount |

---

## WhatsApp Commands (Customer)

| Message | Action |
|---|---|
| `hi` | Start a new order |
| `menu` | Show categories |
| `back` | Return to category list |
| `confirm` | Proceed to checkout |
| `yes` | Confirm order |
| `cancel` | Abandon current cart |
| `track` / `order status` / `my order` | Check active order status |
| `cancel order` | Cancel order (auto if PENDING, request if ACCEPTED/PAID) |
| `1` – `5` (after order complete) | Submit star rating |

---

## Owner WhatsApp Commands

The owner WhatsApp interface is a stateful menu-driven system. Owner sessions are stored in `bot_sessions` keyed by `(ownerPhone, tenantId)` — the owner check runs before the customer FSM, so there's no collision.

| Message | State | Action |
|---|---|---|
| `orders` | any | Show paginated list of tenant's active orders (PENDING → ACCEPTED → PAID, 5 at a time) |
| `1`–`5` | BAKER_LIST | Select that order, show detail + action menu |
| `next` | BAKER_LIST | Next page of orders |
| `prev` | BAKER_LIST | Previous page of orders |
| `back` / `0` | BAKER_DETAIL | Return to order list at same page |
| `1` | BAKER_DETAIL (PENDING) | Accept — notify customer, return to list |
| `2` | BAKER_DETAIL (PENDING) | Reject — notify customer, return to list |
| `1` | BAKER_DETAIL (ACCEPTED) | Send Razorpay payment link to customer |
| `2` | BAKER_DETAIL (ACCEPTED) | Reject — notify customer, return to list |
| `3` | BAKER_DETAIL (ACCEPTED) | Mark Completed — notify customer with feedback prompt |
| `1` | BAKER_DETAIL (PAID) | Mark Completed — notify customer with feedback prompt |

Owner session states: `BAKER_IDLE` → `BAKER_LIST` → `BAKER_DETAIL` → (action executes) → `BAKER_LIST`

---

## Running Locally

```bash
# Install
npm install

# Set up environment
cp .env.example .env.local
# Fill in DATABASE_URL, JWT_SECRET, Twilio, Razorpay vars

# Push schema to DB
npx prisma db push

# Seed menu categories, items, and bot messages
npx tsx prisma/seed.ts

# Create the first tenant from your Twilio WA number
npx tsx prisma/backfill-tenant.ts

# Start dev server
npm run dev

# Expose webhook for WhatsApp testing
npx localtunnel --port 3000
# Set Twilio webhook → https://<tunnel>/api/webhook/whatsapp
```

---

## Deployment

The app is deployed on Vercel. Every `git push origin main` triggers a new production deployment automatically (via Vercel Git integration).

Manual deploy:
```bash
npx vercel --prod
```

All environment variables are managed in Vercel Dashboard → Project → Settings → Environment Variables (or via `vercel env add`).

---

## Known Limitations

- **Twilio Sandbox** — the free sandbox only delivers messages to numbers that have opted in within the last 24 hours. Broadcasts may silently fail if customers haven't messaged recently. This limitation disappears with a verified WhatsApp Business number.
- **Razorpay test mode** — test keys work only with Razorpay test cards. Switch to live keys before taking real payments.
- **Custom order pricing** — custom orders are created with `totalAmount = 0`. The owner must manually set a price and request payment separately.
- **No self-registration** — new tenants must be inserted directly into the `tenants` table (or via the backfill script). There is no `/onboard` signup flow yet.
- **Single WA number per tenant** — each tenant maps to exactly one Twilio WA number. To add a new tenant, register a new WA number and insert a row in `tenants`.
