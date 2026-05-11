# Zesto — WhatsApp Bakery Ordering Bot

A WhatsApp ordering bot + baker dashboard for small bakeries. Customers order via WhatsApp chat; bakers manage orders, menu, and settings from a web dashboard.

**Live:** https://zesto-rose.vercel.app

## Features

- **WhatsApp bot** — conversational ordering flow: categories → items → variants → quantity → delivery date → discount code → confirm
- **Order tracking** — customers type `track` to get live status; `cancel order` to request cancellation
- **Baker dashboard** — orders, conversations, customers CRM, menu manager, analytics, settings
- **Product variants** — size/flavour options with price deltas per item
- **Discount codes** — percent or flat-off, with expiry and usage limits; validated at checkout
- **Broadcast messages** — send a WhatsApp message to all past customers in one click
- **Razorpay payments** — baker sends payment link via WhatsApp; customer pays in browser
- **Post-order feedback** — bot asks for a 1–5 star rating after order is completed
- **OTP login** — baker authenticates via WhatsApp OTP (no password)
- **Menu management** — add/edit items with image, description, variants; hide seasonal items
- **Custom orders** — customer describes a bespoke cake; AI (OpenRouter) reformats for the baker

## Tech Stack

- **Framework**: Next.js 16 App Router (Turbopack)
- **Database**: TiDB Cloud (MySQL) via Prisma 7 + `@tidbcloud/prisma-adapter`
- **WhatsApp / SMS**: Twilio
- **Payments**: Razorpay Standard Checkout
- **Auth**: JWT (jose) + httpOnly cookie
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
   BAKER_PHONE=+91XXXXXXXXXX
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
   npx tsx prisma/seed.ts
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

Navigate to `/login` and enter the baker phone number (`BAKER_PHONE`). OTP is sent via WhatsApp.

## WhatsApp Bot Commands

| Command | Action |
|---------|--------|
| `hi` | Start a new order |
| `menu` | Browse categories |
| `track` / `order status` | Check active order status |
| `cancel order` | Cancel or request cancellation |
| `back` | Return to category list |
| `confirm` | Proceed to checkout |
| `1–5` (after order complete) | Submit star rating |

## Project Structure

```
src/
  app/
    api/
      auth/              # send-otp, verify-otp, logout
      broadcast/         # send WhatsApp to all customers
      contact/           # landing page contact form
      discounts/         # discount code CRUD
      menu/              # categories + items + variants CRUD
      payment/           # Razorpay create-order + verify
      settings/          # bakery config update
      webhook/whatsapp/  # Twilio WhatsApp webhook + bot FSM
    dashboard/
      orders/            # order list + detail with progress tracker
      conversations/     # per-customer message inbox
      customers/         # CRM with spend summary
      broadcast/         # compose + send broadcast
      discounts/         # manage discount codes
      menu/              # menu manager with variants
      analytics/         # revenue + order charts
      settings/          # bakery config, min order, bot messages
    pay/[orderId]/       # customer-facing Razorpay payment page
    login/               # OTP login
  lib/
    bot/fsm.ts           # WhatsApp bot state machine (pure function)
    botSession.ts        # session persistence (Redis-like via DB)
    auth.ts              # JWT helpers
    otp.ts               # OTP generation + verification
    twilio.ts            # Twilio client + sendWhatsApp
    razorpay.ts          # Razorpay client + signature verification
    bakerNotify.ts       # new order WhatsApp notification
  proxy.ts               # auth guard for /dashboard routes
prisma/
  schema.prisma
  seed.ts
tests/
  unit/fsm.test.ts       # Vitest unit tests for bot FSM
```

## Running Tests

```bash
npm test              # Vitest unit tests
npm run test:e2e      # Playwright E2E (requires dev server)
```
