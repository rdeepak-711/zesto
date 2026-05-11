# Zesto — WhatsApp Ordering for Any Business

A multi-tenant WhatsApp ordering bot + owner dashboard. Customers order via WhatsApp chat; business owners manage orders, menu, and settings from a web dashboard. One deployment serves multiple businesses — each with isolated data, their own WhatsApp number, and their own owner login.

**Live:** https://zesto-rose.vercel.app

## Features

- **Multi-tenant SaaS** — one Zesto deployment hosts many businesses; each tenant has their own WA number, menu, orders, and owner login
- **WhatsApp bot** — conversational ordering flow: categories → items → variants → quantity → delivery date → discount code → confirm
- **Order tracking** — customers type `track` to get live status; `cancel order` to request cancellation
- **Owner WhatsApp management** — type `orders` to get a paginated list; pick by number to see detail and take action (accept/reject/pay/complete) — no dashboard required
- **Owner dashboard** — orders, conversations, customers CRM, menu manager, analytics, settings
- **Product variants** — size/flavour options with price deltas per item
- **Discount codes** — percent or flat-off, with expiry and usage limits; validated at checkout
- **Broadcast messages** — send a WhatsApp message to all past customers in one click
- **Razorpay payments** — owner sends payment link via WhatsApp; customer pays in browser
- **Post-order feedback** — bot asks for a 1–5 star rating after order is completed
- **OTP login** — owner authenticates via WhatsApp OTP (no password)
- **Menu management** — add/edit items with image, description, variants; hide seasonal items
- **Custom orders** — customer describes a bespoke item; AI (OpenRouter) reformats for the owner
- **Business types** — bakery, restaurant, grocery, café, pharmacy, pet store, florist, or general retail

## Tech Stack

- **Framework**: Next.js 16 App Router (Turbopack)
- **Database**: TiDB Cloud (MySQL) via Prisma 7 + `@tidbcloud/prisma-adapter`
- **Multi-tenancy**: shared DB, `tenantId` on every table, webhook routing by WA `To` number
- **WhatsApp / SMS**: Twilio
- **Payments**: Razorpay Standard Checkout
- **Auth**: JWT + httpOnly cookie — payload includes `{ phone, tenantId, role: 'owner' }`
- **AI**: OpenRouter (Gemini 2.0 Flash Lite) for custom order formatting
- **Hosting**: Vercel

## Local Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/rdeepak-711/zesto.git
   cd zesto
   npm install
   ```

2. **Environment variables** — copy `.env.example` to `.env.local` and fill in:
   ```
   DATABASE_URL=mysql://...@gateway.tidbcloud.com:4000/zesto
   JWT_SECRET=<64-char random hex>
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxx
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
   OPENROUTER_API_KEY=sk-or-...    # optional — falls back to raw description
   ```

3. **Push schema + seed + backfill first tenant**
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   npx tsx prisma/backfill-tenant.ts   # creates the first tenant row from env vars
   ```

4. **Run dev server**
   ```bash
   npm run dev
   ```

5. **Expose webhook** (for WhatsApp bot testing)
   ```bash
   npx localtunnel --port 3000
   # Set Twilio sandbox webhook to: https://<your-tunnel>/api/webhook/whatsapp
   ```

## Dashboard Login

Navigate to `/login` and enter the owner's phone number. OTP is sent via WhatsApp. Each tenant's owner phone is stored in the `tenants` table — the login resolves the tenant automatically from the phone number.

## WhatsApp Commands

### Customer

| Command | Action |
|---------|--------|
| `hi` | Start a new order |
| `menu` | Browse categories |
| `track` / `order status` | Check active order status |
| `cancel order` | Cancel or request cancellation |
| `back` | Return to category list |
| `confirm` | Proceed to checkout |
| `1–5` (after order complete) | Submit star rating |

### Owner

| Command | Action |
|---------|--------|
| `orders` | Show paginated list of active orders (5 at a time) |
| `1`–`5` (in list) | Select an order to manage |
| `next` / `prev` | Navigate order pages |
| `back` (in detail) | Return to order list |
| `1`–`3` (in detail) | Execute action for the selected order |

**Detail actions by status:**

| Order Status | 1 | 2 | 3 |
|---|---|---|---|
| Pending | Accept | Reject | — |
| Accepted | Request Payment | Reject | Mark Completed |
| Paid | Mark Completed | — | — |

## Project Structure

```
src/
  app/
    api/
      auth/              # send-otp, verify-otp, logout
      broadcast/         # send WhatsApp to tenant's customers
      contact/           # landing page contact form
      discounts/[id]/    # discount code CRUD (auth + tenantId scoped)
      menu/              # categories + items + variants CRUD (tenantId scoped)
      payment/           # Razorpay create-order + verify
      settings/          # tenant config update
      analytics/         # revenue + order analytics (tenantId scoped)
      webhook/whatsapp/  # Twilio webhook — routes by To number → tenant → bot FSM
    dashboard/
      layout.tsx         # auth check, tenant lookup, sidebar with businessName
      orders/            # order list + detail with progress tracker
      conversations/     # per-customer message inbox
      customers/         # CRM with spend summary
      broadcast/         # compose + send broadcast
      discounts/         # manage discount codes
      menu/              # menu manager with variants
      analytics/         # revenue + order charts
      settings/          # tenant config, min order, bot messages
    pay/[orderId]/       # customer-facing Razorpay payment page (shows businessName)
    login/               # OTP login
  lib/
    bot/fsm.ts           # WhatsApp bot state machine (pure function)
    botSession.ts        # session persistence — compound key (phone, tenantId)
    auth.ts              # JWT helpers — AuthPayload: { phone, tenantId, role }
    otp.ts               # OTP generation + verification (stores tenantId)
    twilio.ts            # Twilio client + sendWhatsApp
    razorpay.ts          # Razorpay client + signature verification
    bakerNotify.ts       # new order WhatsApp notification
  proxy.ts               # auth guard for /dashboard routes
prisma/
  schema.prisma
  seed.ts
  backfill-tenant.ts     # creates first tenant from TWILIO_WHATSAPP_NUMBER env var
tests/
  unit/fsm.test.ts       # Vitest unit tests for bot FSM
```

## Running Tests

```bash
npm test              # Vitest unit tests
npm run test:e2e      # Playwright E2E (requires dev server)
```
