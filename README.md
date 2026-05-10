# Zesto — WhatsApp Bakery Ordering Bot

A WhatsApp ordering bot + baker dashboard for small bakeries. Customers order via WhatsApp chat; bakers manage orders, menu, and settings from a web dashboard.

## Features

- **WhatsApp bot** — conversational ordering flow (categories → items → quantity → confirm)
- **Baker dashboard** — orders, conversations, menu manager, analytics, settings
- **OTP login** — baker authenticates via WhatsApp OTP (no password)
- **Menu management** — add/edit/delete items with image, description, and product URL
- **Order notifications** — baker gets WhatsApp message on new order

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: TiDB Cloud (MySQL) via Prisma
- **WhatsApp / SMS**: Twilio
- **Auth**: JWT (jose) + httpOnly cookie
- **Hosting**: Vercel

## Local Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/rdeepak-711/zesto.git
   cd zesto
   npm install
   ```

2. **Environment variables** — copy and fill in `.env.local`:
   ```
   DATABASE_URL=mysql://...
   JWT_SECRET=<64-char random hex>
   BAKER_PHONE=+91XXXXXXXXXX
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxx
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```

3. **Push schema + seed**
   ```bash
   DATABASE_URL="<your-url>?sslaccept=strict" npx prisma db push
   npx prisma db seed
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

## Project Structure

```
src/
  app/
    api/
      auth/          # send-otp, verify-otp, logout
      menu/          # menu categories + items CRUD
      orders/        # order management
      webhook/       # Twilio WhatsApp webhook
    dashboard/       # baker dashboard pages
    login/           # OTP login page
  lib/
    bot/fsm.ts       # WhatsApp bot state machine
    botSession.ts    # session persistence
    auth.ts          # JWT helpers
    otp.ts           # OTP generation + verification
    twilio.ts        # Twilio client
prisma/
  schema.prisma
  seed.ts
```
