# Zesto — Project Documentation

## What Is Zesto?

Zesto is a WhatsApp ordering system built for small bakeries. Instead of taking orders over phone calls or managing a separate app, bakeries give customers a WhatsApp number. Customers chat with a bot to browse the menu and place orders. The baker gets notified on WhatsApp and manages everything from a web dashboard.

The system runs entirely on existing tools customers already have — WhatsApp — with no app downloads, no accounts, and no friction.

---

## How It Works (End to End)

### Customer Side

1. Customer sends "hi" to the bakery's WhatsApp number
2. A bot responds with the menu categories
3. Customer browses items, picks quantities, adds to cart
4. Bot asks for delivery date, applies any discount code, shows order summary
5. Customer confirms
6. Bot replies with order confirmation and a tracking hint
7. If the baker requests payment, customer gets a link to pay online
8. Once the order is ready, customer gets a WhatsApp notification and a prompt for a star rating

### Baker Side

1. Baker receives a WhatsApp notification with order details and short ID
2. Baker replies `ACCEPT ORDERID` or `REJECT ORDERID` directly from WhatsApp
3. On accept, baker sets a delivery date — customer is notified automatically
4. Baker can optionally request payment via Razorpay — a link is sent to the customer's WhatsApp
5. Once payment is received, baker marks the order as Completed
6. Customer gets a completion message and a 1–5 feedback prompt

### Dashboard

The baker also has a full web dashboard at `/dashboard` for deeper management — viewing all orders, reading conversations, managing the menu, creating discount codes, broadcasting messages, and viewing analytics.

---

## Architecture

```
Customer (WhatsApp)
       │
       ▼
  Twilio Sandbox / WhatsApp Business API
       │
       ▼
POST /api/webhook/whatsapp   ← entry point for all inbound messages
       │
       ├─ Pre-FSM handlers (track, cancel order, 1–5 feedback rating)
       │
       └─ Bot FSM (processMessage)
              │
              ├─ Returns: reply text, next state, updated cart
              │
              └─ Webhook saves session, creates order, notifies baker
                        │
                        ▼
                  Baker (WhatsApp)
                  ACCEPT / REJECT reply
                        │
                        ▼
              POST /api/webhook/whatsapp
              (handleBakerReply)
```

The bot is a **pure function** — it takes the current state + message as input and returns the reply + next state. It has no database access. All DB reads and writes happen in the webhook handler before and after calling the FSM.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | TiDB Cloud (MySQL) |
| ORM | Prisma 7 + `@tidbcloud/prisma-adapter` |
| WhatsApp / SMS | Twilio |
| Payments | Razorpay Standard Checkout |
| Auth | JWT (jose) + httpOnly cookie |
| AI | OpenRouter (Gemini 2.0 Flash Lite) |
| Hosting | Vercel |
| Tests | Vitest (unit), Playwright (E2E) |

---

## Database Schema

### Core Tables

**`orders`** — one row per placed order
- `id` (UUID), `customerPhone`, `customerName`, `status`
- `totalAmount` (paise), `discountCode`, `discountAmount`
- `deliveryNote`, `notes` (custom order description)
- `paymentLinkId` (Razorpay order ID), `paymentLinkUrl` (payment ID after success)
- `bakerNotifiedAt`, `createdAt`, `updatedAt`

**`order_items`** — line items per order
- `orderId`, `menuItemId`, `name`, `price`, `quantity`, `variantName`

**`menu_categories`** — e.g. Cakes, Pastries, Cookies
- `id`, `name`, `sortOrder`, `active`, `isCustom`

**`menu_items`** — individual products
- `id`, `categoryId`, `name`, `description`, `price`, `imageUrl`, `available`

**`menu_item_variants`** — size/flavour options per item
- `menuItemId`, `name`, `priceDelta` (added to base price)

**`bot_sessions`** — one row per active customer conversation
- `customerPhone`, `state`, `cart` (JSON), `context` (JSON), `updatedAt`

**`bot_messages`** — all bot reply templates, editable from dashboard
- `key` (e.g. `welcome`, `order_placed`), `label`, `value`

**`bot_rules`** — custom keyword triggers, evaluated before FSM
- `trigger`, `response`, `sortOrder`, `active`

**`bakery_config`** — single row of bakery settings
- `bakeryName`, `bakerPhone`, `whatsappNumber`, `address`
- `welcomeMessage`, `minOrderAmount`, `logoUrl`

**`messages`** — full conversation log (IN + OUT)
- `customerPhone`, `body`, `direction`, `createdAt`

**`broadcasts`** — history of bulk WhatsApp messages sent
- `message`, `sentCount`, `failedCount`, `createdAt`

**`discount_codes`** — promo codes
- `code`, `type` (PERCENT / FLAT), `value`, `minAmount`
- `maxUses`, `usedCount`, `expiresAt`, `active`

**`order_feedback`** — post-order ratings
- `orderId`, `rating` (1–5), `createdAt`

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

### Pre-FSM Handlers (webhook, bypass FSM entirely)

These run before the FSM on every message:

- **Feedback** — if message is `1`–`5` and customer has a completed order without a rating, save feedback and reply. Done.
- **Track** — if message matches `track`, `status`, `my order`, etc., fetch active order and return status message. Done.
- **Cancel order** — if message is `cancel order`, cancel if PENDING, or notify baker if ACCEPTED/PAID. Done.

---

## Payment Flow (Razorpay)

```
Baker Dashboard
  └─ order ACCEPTED
  └─ click "💳 Request Payment"
        │
        ▼
  sendPaymentLink (server action)
        │
        ▼
  sendWhatsApp(customerPhone, "Pay here: /pay/[orderId]")

Customer opens /pay/[orderId] in browser
        │
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
  Baker sees PAID in dashboard → clicks "✓ Mark as Completed"
        │
        ▼
  Customer gets WhatsApp: "Order ready! Rate us 1–5"
```

---

## Auth Flow

The dashboard is protected by a JWT stored in an httpOnly cookie. The auth flow:

1. Baker visits `/login`, enters their phone number
2. Server sends a 6-digit OTP via WhatsApp
3. Baker enters OTP on the verify screen
4. Server validates OTP, issues JWT, sets `zesto_auth` cookie
5. `src/proxy.ts` (Next.js proxy) intercepts every `/dashboard` request and validates the JWT — redirects to `/login` if invalid or missing

---

## Key Files

```
src/
  proxy.ts                          Auth guard for /dashboard
  lib/
    bot/fsm.ts                      Bot state machine (pure function)
    botSession.ts                   Session read/write (DB-backed)
    auth.ts                         JWT sign/verify
    otp.ts                          OTP generate/verify
    twilio.ts                       sendWhatsApp()
    razorpay.ts                     Razorpay client + signature verify
    bakerNotify.ts                  New order WhatsApp notification
    db.ts                           Prisma client singleton

  app/
    page.tsx                        Marketing landing page
    ContactForm.tsx                 Landing page contact form (client)

    api/
      webhook/whatsapp/route.ts     Main bot webhook (all customer messages)
      payment/create-order/route.ts Create Razorpay order
      payment/verify/route.ts       Verify payment signature
      broadcast/route.ts            Send WhatsApp to all customers
      discounts/route.ts            Discount code CRUD
      contact/route.ts              Landing page form → WhatsApp notify
      settings/route.ts             Bakery config update
      analytics/route.ts            Revenue + order analytics data

    pay/[orderId]/
      page.tsx                      Customer-facing payment page
      PayButton.tsx                 Razorpay checkout modal (client)

    dashboard/
      layout.tsx                    Auth check + sidebar layout
      Sidebar.tsx                   Navigation sidebar
      orders/[id]/
        page.tsx                    Order detail + accept/reject/complete
        SendPaymentButton.tsx       Payment request button with toast
      conversations/[phone]/page.tsx  Per-customer message thread
      customers/page.tsx            CRM — all customers with spend
      broadcast/
        page.tsx + BroadcastManager.tsx
      discounts/
        page.tsx + DiscountManager.tsx
      menu/
        page.tsx + MenuManager.tsx  Menu + variants editor
      analytics/page.tsx            Revenue charts
      settings/
        page.tsx + SettingsForm.tsx

prisma/
  schema.prisma                     Full DB schema
  seed.ts                           Seed categories, items, bot messages

tests/
  unit/fsm.test.ts                  19 unit tests for bot FSM
```

---

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `DATABASE_URL` | Prisma | TiDB Cloud connection string |
| `JWT_SECRET` | Auth | Sign/verify session tokens |
| `BAKER_PHONE` | OTP, notifications | Baker's WhatsApp number |
| `TWILIO_ACCOUNT_SID` | Twilio | Account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio | API auth |
| `TWILIO_WHATSAPP_NUMBER` | Twilio | Sender number (`whatsapp:+1...`) |
| `NEXT_PUBLIC_APP_URL` | Payment links | Base URL for `/pay/[id]` links |
| `RAZORPAY_KEY_ID` | Razorpay (server) | API key for order creation |
| `RAZORPAY_KEY_SECRET` | Razorpay (server) | HMAC signature verification |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay (client) | Opens checkout modal |
| `OPENROUTER_API_KEY` | Webhook | AI reformat of custom orders (optional) |
| `UNSPLASH_ACCESS_KEY` | Menu manager | Image search (optional) |

---

## Bot Message Templates

All bot reply text is stored in the `bot_messages` table and editable from the dashboard under **Bot Script**. Templates support placeholders:

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

## Baker WhatsApp Commands

| Message | Action |
|---|---|
| `ACCEPT ORDERID` | Accept the order, notify customer |
| `REJECT ORDERID` | Reject the order, notify customer |
| `REJECT ORDERID` (in response to cancellation) | Accept cancellation request |

---

## Running Locally

```bash
# Install
npm install

# Set up environment
cp .env.example .env.local
# Fill in DATABASE_URL, JWT_SECRET, BAKER_PHONE, Twilio, Razorpay

# Push schema to DB
npx prisma db push

# Seed menu + bot messages
npx tsx prisma/seed.ts

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
- **Custom order pricing** — custom orders are created with `totalAmount = 0`. The baker must manually set a price and request payment separately.
- **Single bakery** — the system is designed for one bakery per deployment (`bakery_config` has a single row with `id = 1`).
