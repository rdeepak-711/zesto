# Zesto — Task Checklist

Track progress here. Each task links to its detailed todo file.

## Phase 1 — Foundation

- [ ] [Task 01](tasks/todo-01.md) — Project scaffold (Next.js 15, Tailwind, shadcn, Vitest, Playwright)
- [ ] [Task 02](tasks/todo-02.md) — Prisma schema + PlanetScale connection
- [ ] [Task 03](tasks/todo-03.md) — Seed data (bakery config + sample menu)
- [ ] [Task 04](tasks/todo-04.md) — Health check API + first Vercel deploy

## Phase 2 — WhatsApp Bot

- [ ] [Task 05](tasks/todo-05.md) — Twilio client + sendWhatsApp helper
- [ ] [Task 06](tasks/todo-06.md) — Bot state machine (pure FSM, fully tested)
- [ ] [Task 07](tasks/todo-07.md) — Bot session management (DB read/write)
- [ ] [Task 08](tasks/todo-08.md) — Twilio webhook handler (inbound → bot)
- [ ] [Task 09](tasks/todo-09.md) — Baker notification on new order (WhatsApp)
- [ ] [Task 10](tasks/todo-10.md) — Baker reply handling (ACCEPT/REJECT via WhatsApp)

## Phase 3 — Dashboard

- [ ] [Task 11](tasks/todo-11.md) — OTP generation + hashing utilities
- [ ] [Task 12](tasks/todo-12.md) — Auth API (send-otp, verify-otp, logout)
- [ ] [Task 13](tasks/todo-13.md) — JWT middleware (protect dashboard routes)
- [ ] [Task 14](tasks/todo-14.md) — Login page UI
- [ ] [Task 15](tasks/todo-15.md) — Orders list page (accept/reject buttons)
- [ ] [Task 16](tasks/todo-16.md) — Order detail page
- [ ] [Task 17](tasks/todo-17.md) — Conversation inbox page
- [ ] [Task 18](tasks/todo-18.md) — Menu manager page (CRUD)

## Phase 4 — Payments

- [ ] [Task 19](tasks/todo-19.md) — Razorpay client + createPaymentLink
- [ ] [Task 20](tasks/todo-20.md) — Order accept API (Razorpay link → WhatsApp)
- [ ] [Task 21](tasks/todo-21.md) — Razorpay webhook handler
- [ ] [Task 22](tasks/todo-22.md) — Payment confirmation message to customer

## Phase 5 — Analytics + Widget

- [ ] [Task 23](tasks/todo-23.md) — Analytics API (summary endpoint)
- [ ] [Task 24](tasks/todo-24.md) — Analytics dashboard page (charts)
- [ ] [Task 25](tasks/todo-25.md) — Embed widget JS (`/public/widget.js`)
- [ ] [Task 26](tasks/todo-26.md) — Settings page (bakery config)
- [ ] [Task 27](tasks/todo-27.md) — Full E2E test suite (Playwright)
