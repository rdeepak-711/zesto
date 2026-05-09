# Zesto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a white-label WhatsApp ordering platform for bakeries — rule-based bot, baker accept/reject flow, Razorpay payments, and a Next.js dashboard — deployed live on Vercel from Phase 1.

**Architecture:** Single Next.js 15 App Router application serving both the dashboard UI and all API routes. MySQL on PlanetScale via Prisma. Twilio drives the WhatsApp bot and OTP auth. Razorpay payment links are auto-sent on order acceptance.

**Tech Stack:** Next.js 15 · TypeScript · MySQL (PlanetScale) · Prisma · Twilio WhatsApp API · Razorpay · Tailwind CSS · shadcn/ui · Vitest · Playwright · Vercel

---

## File Map

```
zesto/
├── prisma/
│   ├── schema.prisma                       # Full DB schema (MySQL, all tables)
│   └── seed.ts                             # Sample menu + bakery config
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root layout (fonts, metadata)
│   │   ├── (dashboard)/                    # Route group — auth-protected
│   │   │   ├── layout.tsx                  # Sidebar + nav shell
│   │   │   ├── page.tsx                    # Home — pending count + today revenue
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx                # Order list with status filters
│   │   │   │   └── [id]/page.tsx           # Order detail + timeline
│   │   │   ├── menu/
│   │   │   │   └── page.tsx                # Category + item CRUD
│   │   │   ├── conversations/
│   │   │   │   └── page.tsx                # WhatsApp inbox threaded by phone
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx                # Revenue, orders, top items charts
│   │   │   └── settings/
│   │   │       └── page.tsx                # Bakery config (name, logo, welcome msg)
│   │   ├── login/
│   │   │   └── page.tsx                    # Phone OTP login form
│   │   └── api/
│   │       ├── health/route.ts             # GET — DB ping, returns 200
│   │       ├── webhook/
│   │       │   ├── twilio/route.ts         # POST — inbound WhatsApp messages
│   │       │   └── razorpay/route.ts       # POST — payment status webhooks
│   │       ├── auth/
│   │       │   ├── send-otp/route.ts       # POST — generate + SMS OTP
│   │       │   ├── verify-otp/route.ts     # POST — verify OTP, set JWT cookie
│   │       │   └── logout/route.ts         # DELETE — clear session cookie
│   │       ├── orders/
│   │       │   ├── route.ts                # GET — list orders
│   │       │   └── [id]/
│   │       │       ├── accept/route.ts     # PATCH — accept + trigger payment link
│   │       │       └── reject/route.ts     # PATCH — reject + notify customer
│   │       ├── menu/
│   │       │   ├── categories/
│   │       │   │   ├── route.ts            # GET/POST categories
│   │       │   │   └── [id]/route.ts       # PUT/DELETE category
│   │       │   └── items/
│   │       │       ├── route.ts            # GET/POST items
│   │       │       ├── [id]/route.ts       # PUT/DELETE item
│   │       │       └── [id]/toggle/route.ts# PATCH — toggle availability
│   │       ├── analytics/
│   │       │   └── summary/route.ts        # GET — revenue, orders, conversion
│   │       └── messages/route.ts           # GET — conversation history
│   ├── lib/
│   │   ├── db.ts                           # Prisma client singleton
│   │   ├── auth.ts                         # JWT sign/verify + session cookie helpers
│   │   ├── twilio.ts                       # Twilio client + sendWhatsApp helper
│   │   ├── razorpay.ts                     # Razorpay client + createPaymentLink
│   │   ├── otp.ts                          # generateOtp, hashOtp, verifyOtp
│   │   └── currency.ts                     # paiseToCurrency, currencyToPaise
│   ├── bot/
│   │   ├── state-machine.ts               # Pure FSM: transition(state, input) → next
│   │   ├── handlers.ts                    # One handler per bot state
│   │   ├── messages.ts                    # All bot reply string templates
│   │   └── session.ts                     # DB read/write for bot_sessions
│   ├── middleware.ts                       # Redirect /dashboard/* to /login if no JWT
│   └── types/
│       └── index.ts                        # Shared TS types (Order, MenuItem, etc.)
├── public/
│   └── widget.js                           # Self-contained embed script
├── tests/
│   ├── bot/
│   │   ├── state-machine.test.ts
│   │   └── handlers.test.ts
│   ├── api/
│   │   ├── webhook-twilio.test.ts
│   │   ├── orders.test.ts
│   │   └── auth.test.ts
│   └── e2e/
│       ├── login.spec.ts
│       ├── orders.spec.ts
│       └── menu.spec.ts
├── vitest.config.ts
├── playwright.config.ts
├── .env.example
└── tasks/
    ├── todo-01.md  … todo-27.md            # One file per task (detailed steps)
```

---

## Phases Overview

| Phase | Tasks | Deliverable |
|---|---|---|
| 1 — Foundation | 01–04 | Live Vercel deploy, DB migrated, health check green |
| 2 — WhatsApp Bot | 05–10 | Full ordering flow end-to-end in WhatsApp |
| 3 — Dashboard | 11–18 | Baker can login, view/accept/reject orders, manage menu |
| 4 — Payments | 19–22 | Razorpay links auto-sent, payment confirmed end-to-end |
| 5 — Analytics + Widget | 23–27 | Charts live, embed widget working, E2E suite green |

---

## Task Index

| # | Task | Phase |
|---|---|---|
| 01 | Project scaffold (Next.js 15, Tailwind, shadcn, Vitest, Playwright) | 1 |
| 02 | Prisma schema + PlanetScale connection | 1 |
| 03 | Seed data (bakery config + sample menu) | 1 |
| 04 | Health check API + Vercel deploy | 1 |
| 05 | Twilio client + sendWhatsApp helper | 2 |
| 06 | Bot state machine (pure FSM, fully tested) | 2 |
| 07 | Bot session management (DB read/write) | 2 |
| 08 | Twilio webhook handler (inbound messages → bot) | 2 |
| 09 | Baker notification on new order (WhatsApp) | 2 |
| 10 | Baker reply handling — ACCEPT/REJECT via WhatsApp | 2 |
| 11 | OTP generation + hashing utilities | 3 |
| 12 | Auth API (send-otp, verify-otp, logout) | 3 |
| 13 | JWT middleware (protect dashboard routes) | 3 |
| 14 | Login page UI | 3 |
| 15 | Orders list page (accept/reject buttons) | 3 |
| 16 | Order detail page | 3 |
| 17 | Conversation inbox page | 3 |
| 18 | Menu manager page (category + item CRUD) | 3 |
| 19 | Razorpay client + createPaymentLink | 4 |
| 20 | Order accept API (Razorpay link → WhatsApp) | 4 |
| 21 | Razorpay webhook handler | 4 |
| 22 | Payment confirmation message to customer | 4 |
| 23 | Analytics API (summary endpoint) | 5 |
| 24 | Analytics dashboard page (charts) | 5 |
| 25 | Embed widget JS (`/public/widget.js`) | 5 |
| 26 | Settings page (bakery config) | 5 |
| 27 | Full E2E test suite (Playwright) | 5 |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# PlanetScale MySQL
DATABASE_URL="mysql://..."

# Twilio
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="xxxxx"
TWILIO_WHATSAPP_NUMBER="whatsapp:+91xxxxxxxxxx"

# Razorpay
RAZORPAY_KEY_ID="rzp_test_xxxxx"
RAZORPAY_KEY_SECRET="xxxxx"
RAZORPAY_WEBHOOK_SECRET="xxxxx"

# Auth
JWT_SECRET="at-least-32-random-chars"

# App
NEXT_PUBLIC_WHATSAPP_NUMBER="+91xxxxxxxxxx"
NEXT_PUBLIC_APP_URL="https://your-deployment.vercel.app"
BAKER_PHONE="+91xxxxxxxxxx"
```

---

See `tasks/todo-01.md` through `tasks/todo-27.md` for step-by-step implementation with full code.
