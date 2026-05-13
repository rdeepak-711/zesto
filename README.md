# Zesto — WhatsApp Ordering for Any Business

A multi-tenant WhatsApp ordering bot + owner dashboard. Customers order via WhatsApp chat; business owners manage orders, menu, and settings from a web dashboard. One deployment serves multiple businesses — each with isolated data, their own WhatsApp number, and their own owner login.

**Live:** https://zesto-rose.vercel.app

## Features

- **Multi-tenant SaaS** — one Zesto deployment hosts many businesses; each tenant has their own WA number, menu, orders, and owner login
- **Self-service onboarding** — new tenants run a 3-step setup wizard (store settings → menu builder → bot script) before the dashboard unlocks
- **WhatsApp bot** — conversational ordering flow: categories → items → category fields → quantity → delivery date → discount code → confirm
- **Category fields** — per-category customisation questions (multiple choice or short text) asked at order time; answers stored as JSON on each order item
- **Order tracking** — customers type `track` to get live status; `cancel order` to request cancellation
- **Owner WhatsApp management** — type `orders` for a paginated list; pick by number to see detail and take action (accept/reject/pay/complete) — no dashboard needed
- **Owner dashboard** — orders, conversations, customers CRM, menu manager, analytics, bot script, settings
- **Discount codes** — percent or flat-off, with expiry and usage limits; validated at checkout
- **Broadcast messages** — send a WhatsApp message to all past customers in one click
- **Razorpay payments** — owner sends payment link via WhatsApp; customer pays in browser
- **Post-order feedback** — bot asks for a 1–5 star rating after order is completed
- **OTP login** — owner authenticates via WhatsApp OTP (no password)
- **Delivery date toggle** — enable/disable delivery date collection per tenant, with customisable prompt label
- **Business hours** — open/close time, open days, and timezone stored per tenant
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

3. **Push schema + seed**
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts                # seeds bot message keys + sample menu
   npx tsx prisma/seed-demo-tenants.ts  # creates 5 demo tenants (dev only)
   npx tsx prisma/backfill-tenant.ts    # creates first production tenant from env vars
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

## Onboarding a New Tenant

New tenants are created by inserting a row in the `tenants` table (via `backfill-tenant.ts` or directly). On first dashboard login, the tenant has no menu categories — the dashboard redirects them to `/dashboard/setup` where a 3-step wizard collects:

1. **Store settings** — business name, type, address, hours, timezone, social links
2. **Menu builder** — categories, items (name + price), and per-category customisation fields
3. **Bot script** — review/edit auto-seeded bot messages → "Go live" bootstraps 37 default messages and redirects to the dashboard

In development, use the dev login bypass to skip OTP:
```
http://localhost:3000/api/dev/login?phone=+91XXXXXXXXXX
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
      bootstrap/         # POST — seeds 37 bot messages + Custom Order category for a tenant
      broadcast/         # send WhatsApp to tenant's customers
      contact/           # landing page contact form
      dev/login/         # GET — dev-only OTP bypass (blocked in production)
      discounts/[id]/    # discount code CRUD (auth + tenantId scoped)
      menu/              # categories + items + category fields CRUD (tenantId scoped)
      onboard/           # POST — saves Step 1 + Step 2 wizard data
      payment/           # Razorpay create-order + verify
      settings/          # tenant config update
      analytics/         # revenue + order analytics (tenantId scoped)
      webhook/whatsapp/  # Twilio webhook — routes by To number → tenant → bot FSM
    dashboard/
      layout.tsx         # auth check, tenant lookup, sidebar with businessName
      page.tsx           # redirects to /dashboard/setup if no menu categories exist
      setup/             # 3-step onboarding wizard (store → menu → bot script)
      orders/            # order list + detail with progress tracker
      conversations/     # per-customer message inbox
      customers/         # CRM with spend summary
      broadcast/         # compose + send broadcast
      discounts/         # manage discount codes
      menu/              # menu manager with category fields builder
      analytics/         # revenue + order charts
      settings/          # tenant config, delivery date, bot messages
      bot/               # bot script editor
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
  seed.ts                # bot message keys + sample menu for dev
  seed-demo-tenants.ts   # 5 demo tenants for local testing
  backfill-tenant.ts     # creates first tenant from TWILIO_WHATSAPP_NUMBER env var
  bootstrapTenant.ts     # seeds 37 default bot messages per tenant
  migrate-variants.ts    # one-time migration: item variants → category fields
tests/
  unit/fsm.test.ts       # Vitest unit tests for bot FSM
```

## Running Tests

```bash
npm test              # Vitest unit tests
npm run test:e2e      # Playwright E2E (requires dev server)
```
