# Outbuiltit — WhatsApp Bot + Owner Dashboard for Any Business

> Formerly **Zesto**. (Repo name kept as `zesto`.)

A multi-tenant SaaS platform that turns WhatsApp into a fully automated ordering counter, booking desk, and enquiry line — backed by a clean owner dashboard.

**Live product:** https://outbuiltit.com  

---

## What It Does

Customers send "hi" to a business's WhatsApp number. The bot greets them, shows menus or services, takes an order or books an appointment, collects payment details, and confirms — all inside WhatsApp, no app download required.

Business owners manage everything from a web dashboard: accept orders, confirm bookings, track revenue, update menus, and send broadcast messages.

### Supported Business Types

| Business | Flow |
|----------|------|
| Bakery / Restaurant / Café / Grocery | Cart ordering: categories → items → category fields → quantity → delivery date → discount → confirm |
| Salon / Makeup Studio / Service | Booking: service → confirm → name → age → date → time slot → confirmed |
| Photo Studio / Custom Shop | Enquiry: keyword routing → product-specific questionnaire → owner notified |

---

## Features

- **Multi-tenant SaaS** — one deployment, many businesses; each tenant has isolated data, their own WhatsApp number, and their own owner login
- **WhatsApp ordering bot** — full FSM: categories → items → category fields → quantity → delivery date → discount → confirm
- **Booking flow** — appointment booking FSM with calendar dashboard (Confirm / Reschedule / Cancel + Notify)
- **Enquiry mode** — AI-assisted product routing for photo studios and custom shops
- **Category fields** — per-category customisation questions (multiple choice or short text) stored as JSON per order item
- **Owner dashboard** — orders, bookings calendar, conversations, customers CRM, menu manager, analytics, bot script editor, settings
- **Analytics** — 30-day revenue chart, top items, peak hours, repeat rate, avg order value
- **Broadcast messages** — send WhatsApp to all/segmented past customers in one click
- **Discount codes** — percent or flat-off, with expiry and usage limits; validated at checkout
- **Razorpay payments** — owner sends payment link via WhatsApp; customer pays in browser
- **Post-order feedback** — bot asks for 1–5 star rating after order is completed
- **Order tracking** — customers type `track` for live status; `cancel order` to request cancellation
- **Owner WhatsApp management** — type `orders` for paginated list; manage (accept/reject/pay/complete) entirely from WhatsApp
- **OTP login** — owner authenticates via WhatsApp OTP; no password
- **AI info-bot** — any customer question triggers Gemini 2.0 Flash Lite with full menu knowledge and conversation history, in any FSM state
- **Custom orders** — customer describes a bespoke item; AI reformats for the owner
- **Capability flags** — `hasCart`, `hasBooking`, `hasEnquiry`, `hasDelivery` on each tenant; FSM branches on flags, not business type — new business types require zero code changes
- **Self-service onboarding** — 3-step setup wizard (store settings → menu builder → bot script)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router (Turbopack) |
| Database | TiDB Cloud (MySQL-compatible) via Prisma 7 + `@tidbcloud/prisma-adapter` |
| WhatsApp / SMS | Twilio |
| Payments | Razorpay Standard Checkout |
| Auth | JWT + httpOnly cookie — `{ phone, tenantId, role: 'owner' }` |
| AI | OpenRouter (Gemini 2.0 Flash Lite) — info-bot + custom order reformatting |
| Hosting | Vercel |

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/rdeepak-711/zesto.git
cd zesto
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
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

### 3. Push schema and seed

```bash
npx prisma db push
npx tsx prisma/seed.ts                # bot message keys + sample menu
npx tsx prisma/seed-demo-tenants.ts  # 5 demo tenants (dev only)
npx tsx prisma/backfill-tenant.ts    # creates first production tenant
```

### 4. Run dev server

```bash
npm run dev
```

### 5. Expose webhook (for WhatsApp bot testing)

```bash
npx localtunnel --port 3000
# Set Twilio sandbox webhook to: https://<your-tunnel>/api/webhook/whatsapp
```

---

## Demo Tenants

Three demo tenants are seeded for local testing:

| Business | Type | Login number |
|----------|------|-------------|
| Sweet Crumbs Bakery | Bakery (ordering) | `+919800000001` |
| Phoenix Photo Studio | Photo studio (enquiry) | `+917010044626` |
| Glow Zone | Salon (ordering + booking) | `+919952050806` |

Use OTP bypass code `000000` if `TEST_OTP_BYPASS=true` is set.

---

## Dashboard Sections

| Section | Description |
|---------|-------------|
| **Orders** | Real-time order list with Accept / Reject / Payment / Complete actions |
| **Bookings** | Monthly calendar view; click to confirm, reschedule, or cancel with notification |
| **Conversations** | Per-customer WhatsApp message thread |
| **Customers** | CRM: phone, order count, lifetime spend |
| **Menu** | Category + item tree with images, prices, availability toggle, and category fields |
| **Bot Script** | FSM flow diagram; inline message editing; live animated phone preview (tenant-aware) |
| **Discounts** | Create and manage discount codes |
| **Broadcast** | Compose and send WhatsApp to customer segments |
| **Analytics** | Revenue chart, top items, peak hours, repeat rate |
| **Settings** | Business info, delivery date toggle, Razorpay credentials |

---

## WhatsApp Commands

### Customer

| Command | Action |
|---------|--------|
| `hi` / `hello` | Start a new session |
| `menu` | Browse categories from any state |
| `track` | Check active order status |
| `cancel order` | Cancel or request cancellation |
| `1–5` (after order complete) | Submit star rating |

### Owner

| Command | Action |
|---------|--------|
| `orders` | Paginated list of active orders |
| `1`–`5` | Select an order to manage |
| `next` / `prev` | Navigate order pages |
| `back` | Return to list |
| `1`–`3` (in detail) | Execute action (accept/reject/pay/complete) |

---

## Running Tests

```bash
npm test              # Vitest unit tests (79 passing)
npm run test:e2e      # Playwright E2E (requires dev server)
```

---

## Project Structure

```
src/
  app/
    page.tsx                   # Landing home
    idea/page.tsx              # The idea page
    product/page.tsx           # Dashboard feature tour
    api/
      auth/                    # send-otp, verify-otp, logout
      bootstrap/               # Seeds 37 bot messages for a tenant
      broadcast/               # Send WhatsApp to tenant's customers
      contact/                 # Landing page contact form
      dev/login/               # Dev-only OTP bypass (blocked in production)
      discounts/[id]/          # Discount code CRUD (tenantId scoped)
      menu/                    # Categories + items + category fields CRUD
      onboard/                 # Saves onboarding wizard data
      payment/                 # Razorpay create-order + verify
      settings/                # Tenant config update
      analytics/               # Revenue + order analytics
      webhook/whatsapp/        # Twilio webhook → tenant lookup → bot FSM
    dashboard/
      layout.tsx               # Auth check, tenant lookup, sidebar
      page.tsx                 # Redirects to /dashboard/setup if no menu
      setup/                   # 3-step onboarding wizard
      orders/                  # Order list + detail with status tracker
      bookings/                # Booking calendar + confirm/reschedule/cancel panel
      conversations/           # Per-customer message inbox
      customers/               # CRM with spend summary
      broadcast/               # Compose + send broadcast
      discounts/               # Manage discount codes
      menu/                    # Menu manager with category fields builder
      analytics/               # Revenue + order charts
      settings/                # Tenant config, Razorpay, delivery date
      bot/                     # Bot script editor + FSM flow + live phone preview
    pay/[orderId]/             # Customer-facing Razorpay payment page
    login/                     # OTP login
  lib/
    bot/fsm.ts                 # WhatsApp bot FSM (pure function)
    bot/bookingCommands.ts     # parseBookingCommand utility
    botSession.ts              # Session persistence (phone + tenantId)
    auth.ts                    # JWT helpers
    otp.ts                     # OTP generation + verification
    twilio.ts                  # Twilio client + sendWhatsApp
    razorpay.ts                # Razorpay client + signature verification
    bakerNotify.ts             # New order WhatsApp notification
  proxy.ts                     # Auth guard for /dashboard routes
prisma/
  schema.prisma
  seed.ts                      # Bot message keys + sample menu (dev)
  seed-demo-tenants.ts         # 5 demo tenants for local testing
  backfill-tenant.ts           # Creates first tenant from env vars
  bootstrapTenant.ts           # Seeds 37 default bot messages per tenant
  seed-glowzone.ts             # Glow Zone demo salon tenant (hasBooking=true)
tests/
  unit/fsm.test.ts             # Vitest unit tests for bot FSM (79 passing)
```
