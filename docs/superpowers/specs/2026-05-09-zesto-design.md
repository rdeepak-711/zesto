# Zesto — Design Spec
**Date:** 2026-05-09  
**Status:** Approved  
**Model:** White-label (one Vercel deploy per bakery client)  
**Region:** India — INR, Razorpay  

---

## 1. What We're Building

Zesto is a white-label WhatsApp ordering platform for bakeries (and later, any food business). Each bakery gets a self-contained deployment with:

- A **WhatsApp bot** (Twilio) that handles customer menu browsing, ordering, and payment
- A **web dashboard** for the baker to manage orders, menu, and view analytics
- An **embeddable JS widget** that renders a WhatsApp floating button on any website
- **Razorpay payment links** auto-sent to customers after baker confirms an order

The baker can accept or reject any order from either the dashboard or directly via WhatsApp reply — whichever they're on at the time.

---

## 2. Architecture

```
Customer Website
      │  (embed script)
      ▼
WhatsApp Button ──► Twilio WhatsApp Number
                          │
                    Next.js Webhook API
                          │
                    ┌─────┴──────┐
                    │   MySQL    │  (PlanetScale, via Prisma)
                    └─────┬──────┘
                          │
                    Baker Dashboard  (Next.js App Router)
                          │
                    Baker WhatsApp   (Twilio outbound)
```

**Single Next.js 15 app** serves both the dashboard (App Router pages) and all API routes (webhook, auth, orders, payments).

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript) | Full-stack, Vercel-native |
| Database | MySQL via PlanetScale | Serverless MySQL, no connection pooling issues on Vercel |
| ORM | Prisma | Type-safe, works with PlanetScale (no foreign key enforcement needed) |
| WhatsApp | Twilio WhatsApp Business API | Client has existing account |
| Payments | Razorpay Payment Links API | India-native, INR, UPI support |
| Auth | Phone OTP (Twilio SMS) + JWT session cookie | Fits WhatsApp-first bakery audience |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent UI components |
| Hosting | Vercel | Continuous deploy from day 1 |
| Testing | Vitest (unit/integration) + Playwright (E2E) | TDD bottom-up |

---

## 4. Core Flows

### 4.1 Customer Ordering Flow

1. Customer opens WhatsApp (via widget button or direct number)
2. Sends any message → bot replies with greeting + numbered category list
3. Customer types a number → bot shows items in that category (numbered)
4. Customer types item number → bot asks for quantity
5. Customer types quantity → bot adds to cart, asks "Add more? (yes/no)"
6. Customer types "no" → bot shows order summary with total
7. Customer confirms → order saved as `PENDING`
8. Bot notifies baker via WhatsApp: order details + two reply options ("1 Accept" / "2 Reject")
9. Baker replies "1" → order moves to `ACCEPTED`, Razorpay payment link auto-sent to customer
10. Baker replies "2" → order moves to `REJECTED`, customer notified
11. Customer pays via link → Razorpay webhook fires → order moves to `PAID`
12. Bot sends payment confirmation to customer

### 4.2 Baker Accept/Reject from Dashboard

Same result as WhatsApp flow — baker clicks Accept or Reject button in the orders list. System sends the same notifications either way.

### 4.3 Baker Dashboard Login (Phone OTP)

1. Baker visits `/login`, enters their registered phone number
2. Twilio SMS sends a 6-digit OTP
3. Baker enters OTP → server verifies → sets an HTTP-only JWT session cookie (24h expiry)
4. Redirected to dashboard home

### 4.4 Embed Widget

Bakery adds one script tag to their website:
```html
<script src="https://<deployment>.vercel.app/widget.js"></script>
```
Widget reads `NEXT_PUBLIC_WHATSAPP_NUMBER` and renders a floating green WhatsApp button. Clicking it opens `https://wa.me/<number>` in a new tab.

---

## 5. Data Model

### `orders`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | UUID |
| customer_phone | VARCHAR(20) | WhatsApp sender number |
| customer_name | VARCHAR(100) | Captured during flow |
| total_amount | INT | In paise (₹1 = 100 paise) |
| status | ENUM | PENDING, ACCEPTED, REJECTED, PAID, COMPLETED |
| payment_link_id | VARCHAR(100) | Razorpay payment link ID |
| payment_link_url | VARCHAR(500) | Sent to customer |
| baker_notified_at | DATETIME | When baker WhatsApp was sent |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### `order_items`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| order_id | VARCHAR(36) FK | |
| menu_item_id | VARCHAR(36) FK | |
| name | VARCHAR(100) | Snapshot at time of order |
| price | INT | Snapshot in paise |
| quantity | INT | |

### `menu_categories`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| name | VARCHAR(100) | e.g. "Cakes", "Pastries" |
| sort_order | INT | Display order in bot |
| active | TINYINT(1) | |

### `menu_items`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| category_id | VARCHAR(36) FK | |
| name | VARCHAR(100) | |
| description | TEXT | |
| price | INT | In paise |
| image_url | VARCHAR(500) | |
| available | TINYINT(1) | Toggle off without deleting |
| sort_order | INT | |

### `messages`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| customer_phone | VARCHAR(20) | |
| body | TEXT | Raw message text |
| direction | ENUM | IN (from customer), OUT (from bot) |
| order_id | VARCHAR(36) FK nullable | Set once order is created |
| twilio_sid | VARCHAR(100) | For deduplication |
| created_at | DATETIME | |

### `bot_sessions`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| customer_phone | VARCHAR(20) UNIQUE | |
| state | VARCHAR(50) | Current state in the flow |
| cart_json | JSON | Items added so far |
| last_active | DATETIME | Session expires after 30min of inactivity |

### `bakery_config`
| Column | Type | Notes |
|---|---|---|
| id | INT PK | Always 1 row |
| bakery_name | VARCHAR(100) | |
| baker_phone | VARCHAR(20) | For OTP login + order notifications |
| whatsapp_number | VARCHAR(20) | Twilio number in E.164 |
| logo_url | VARCHAR(500) | |
| address | TEXT | Shown in bot greeting |
| currency | VARCHAR(3) | INR |
| welcome_message | TEXT | Customisable greeting |

### `otp_sessions`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(36) PK | |
| phone | VARCHAR(20) | |
| code | VARCHAR(6) | Hashed |
| expires_at | DATETIME | 10 min TTL |
| used | TINYINT(1) | One-time use |

---

## 6. Bot State Machine

```
IDLE
  │  any message → greeting + categories
  ▼
AWAITING_CATEGORY
  │  valid number → load items
  ▼
AWAITING_ITEM
  │  valid number → ask quantity
  ▼
AWAITING_QUANTITY
  │  valid number → add to cart
  ▼
AWAITING_MORE          ← loop back to AWAITING_CATEGORY or continue
  │  "no" → show summary
  ▼
AWAITING_CONFIRMATION
  │  "yes" / "confirm" → save order, notify baker
  ▼
ORDER_PENDING          ← terminal for customer; baker acts from here
```

Invalid input at any state → bot re-prompts with the same question.  
Typing "menu" or "restart" at any state → resets to IDLE.

---

## 7. API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/webhook/twilio` | Receive inbound WhatsApp messages |
| POST | `/api/webhook/razorpay` | Payment confirmation from Razorpay |
| POST | `/api/auth/send-otp` | Send OTP to baker phone |
| POST | `/api/auth/verify-otp` | Verify OTP, set session cookie |
| DELETE | `/api/auth/logout` | Clear session |
| GET | `/api/orders` | List orders (dashboard) |
| PATCH | `/api/orders/[id]/accept` | Accept order, trigger payment link |
| PATCH | `/api/orders/[id]/reject` | Reject order, notify customer |
| GET | `/api/menu/categories` | List categories |
| POST | `/api/menu/categories` | Create category |
| PUT | `/api/menu/categories/[id]` | Update category |
| GET | `/api/menu/items` | List items |
| POST | `/api/menu/items` | Create item |
| PUT | `/api/menu/items/[id]` | Update item |
| PATCH | `/api/menu/items/[id]/toggle` | Toggle availability |
| GET | `/api/analytics/summary` | Revenue, orders, conversion for date range |
| GET | `/api/messages` | Conversation history |

---

## 8. Dashboard Pages

| Route | Page |
|---|---|
| `/login` | Phone OTP login |
| `/` | Home — pending orders count, today's revenue |
| `/orders` | Full order list with status filters |
| `/orders/[id]` | Order detail — items, customer, timeline |
| `/menu` | Menu manager — categories + items |
| `/conversations` | Inbox — all customer WhatsApp threads |
| `/analytics` | Charts — revenue, orders, conversion, top items |
| `/settings` | Bakery config — name, logo, welcome message |

---

## 9. Environment Variables (per deployment)

```env
# Database
DATABASE_URL=mysql://...

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+91...

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Auth
JWT_SECRET=
OTP_EXPIRY_MINUTES=10

# App
NEXT_PUBLIC_WHATSAPP_NUMBER=+91...
NEXT_PUBLIC_APP_URL=https://...
```

---

## 10. Build Phases

### Phase 1 — Foundation (deploy #1)
- Prisma schema (all tables), PlanetScale connection, seed data
- Vercel project created, env vars set, first deploy live
- Health check endpoint `/api/health`

### Phase 2 — WhatsApp Bot
- Twilio webhook handler
- Bot state machine (full ordering flow)
- Baker WhatsApp notification on new order
- Baker can reply "1"/"2" to accept/reject via WhatsApp

### Phase 3 — Dashboard
- Phone OTP auth (send + verify, JWT cookie)
- Orders page — list, filter, accept/reject buttons
- Conversation inbox — threaded by customer phone
- Menu manager — CRUD for categories and items

### Phase 4 — Payments
- Razorpay payment link creation on order accept
- Auto-send link to customer via WhatsApp
- Razorpay webhook → order status → PAID
- Payment confirmation message to customer

### Phase 5 — Analytics + Widget
- Analytics API + dashboard charts (revenue, orders, conversion rate, top items, peak hours)
- Embed JS widget (`/widget.js`)
- White-label env var documentation
- Final E2E tests across full flow

---

## 11. Testing Strategy (TDD Bottom-up)

Each phase starts with tests before implementation:

- **Unit tests (Vitest):** Pure functions — state machine transitions, price calculations, OTP generation, message formatting
- **Integration tests (Vitest + test DB):** API routes — webhook processing, order acceptance, payment flow
- **E2E tests (Playwright):** Dashboard flows — login, accept order, menu CRUD, analytics page loads

Every phase must have passing tests before moving to the next.
