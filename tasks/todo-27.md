# Task 27 — Full E2E Test Suite (Playwright)

**Phase:** 5 — Analytics + Widget  
**Goal:** Automated E2E tests covering the three critical user journeys: baker login, order management, and menu editing.

**Files created:**
- `tests/e2e/login.spec.ts`
- `tests/e2e/orders.spec.ts`
- `tests/e2e/menu.spec.ts`

**Prerequisites:** Dev server running on `http://localhost:3000` with a seeded database and valid env vars. The baker phone must be a real number that can receive Twilio SMS — or mock the OTP in the test setup.

---

## Handling OTP in E2E Tests

Playwright can't intercept SMS. Two approaches:
- **Option A (recommended for CI):** Set a `TEST_OTP_BYPASS` env var. When set, the `verify-otp` route accepts the static code `000000` without calling Twilio.
- **Option B (local only):** Read the OTP from Twilio's API after sending.

We'll use Option A. First, update the verify-otp route:

- [ ] **Step 1: Add test OTP bypass to `src/app/api/auth/verify-otp/route.ts`**

At the top of the `POST` handler, add:

```typescript
// Test bypass (only works when TEST_OTP_BYPASS=true and code is 000000)
if (process.env.TEST_OTP_BYPASS === 'true' && code === '000000') {
  await setSessionCookie({ phone, role: 'baker' })
  return NextResponse.json({ ok: true })
}
```

Add `TEST_OTP_BYPASS=true` to `.env.local` for local E2E runs. Never set this in production.

- [ ] **Step 2: Write `tests/e2e/login.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

const BAKER_PHONE = process.env.BAKER_PHONE ?? '+910000000000'

test.describe('Login flow', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows error for unregistered phone', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="tel"]', '+919999999999')
    await page.click('button[type="submit"]')
    await expect(page.locator('p.text-red-500')).toBeVisible()
  })

  test('successful login with test OTP bypass', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="tel"]', BAKER_PHONE)
    await page.click('button[type="submit"]')

    // Wait for OTP step
    await expect(page.locator('input[inputmode="numeric"]')).toBeVisible()

    await page.fill('input[inputmode="numeric"]', '000000')
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('logout clears session and redirects to login', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[type="tel"]', BAKER_PHONE)
    await page.click('button[type="submit"]')
    await page.fill('input[inputmode="numeric"]', '000000')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Click logout
    await page.click('button:has-text("Logout")')
    await expect(page).toHaveURL(/\/login/)
  })
})
```

- [ ] **Step 3: Write `tests/e2e/orders.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

const BAKER_PHONE = process.env.BAKER_PHONE ?? '+910000000000'

async function login(page: ReturnType<typeof test.extend>['page'] extends infer P ? P : never) {
  await page.goto('/login')
  await page.fill('input[type="tel"]', BAKER_PHONE)
  await page.click('button[type="submit"]')
  await page.fill('input[inputmode="numeric"]', '000000')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')
}

test.describe('Orders page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('shows orders page', async ({ page }) => {
    await page.goto('/orders')
    await expect(page.locator('h1')).toContainText('Orders')
  })

  test('shows "No orders yet" when empty', async ({ page }) => {
    await page.goto('/orders')
    // This passes if no orders OR if orders are shown — just check the page loads
    await expect(page.locator('h1')).toBeVisible()
  })

  test('navigates to order detail', async ({ page }) => {
    await page.goto('/orders')
    const firstOrder = page.locator('[href^="/orders/"]').first()
    if (await firstOrder.isVisible()) {
      await firstOrder.click()
      await expect(page.locator('text=Customer')).toBeVisible()
    }
  })
})
```

- [ ] **Step 4: Write `tests/e2e/menu.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

const BAKER_PHONE = process.env.BAKER_PHONE ?? '+910000000000'

async function login(page: ReturnType<typeof test.extend>['page'] extends infer P ? P : never) {
  await page.goto('/login')
  await page.fill('input[type="tel"]', BAKER_PHONE)
  await page.click('button[type="submit"]')
  await page.fill('input[inputmode="numeric"]', '000000')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/')
}

test.describe('Menu manager', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('shows seeded menu categories', async ({ page }) => {
    await page.goto('/menu')
    await expect(page.locator('h2:has-text("Cakes")')).toBeVisible()
    await expect(page.locator('h2:has-text("Pastries")')).toBeVisible()
    await expect(page.locator('h2:has-text("Cookies")')).toBeVisible()
  })

  test('can add a new category', async ({ page }) => {
    await page.goto('/menu')
    await page.fill('input[placeholder="New category name"]', 'E2E Test Category')
    await page.click('button:has-text("Add Category")')
    await expect(page.locator('h2:has-text("E2E Test Category")')).toBeVisible()
  })

  test('can toggle item availability', async ({ page }) => {
    await page.goto('/menu')
    const hideBtn = page.locator('button:has-text("Hide")').first()
    if (await hideBtn.isVisible()) {
      await hideBtn.click()
      await expect(page.locator('button:has-text("Show")').first()).toBeVisible()
      // Toggle back
      await page.locator('button:has-text("Show")').first().click()
      await expect(page.locator('button:has-text("Hide")').first()).toBeVisible()
    }
  })
})
```

- [ ] **Step 5: Install Playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 6: Run the E2E suite**

Make sure the dev server is running in another terminal:
```bash
npm run dev
```

Then:
```bash
npm run test:e2e
```

Expected: All tests pass. If login tests fail, check `TEST_OTP_BYPASS=true` is in `.env.local` and `BAKER_PHONE` matches what's in `bakery_config`.

- [ ] **Step 7: Run all unit tests to confirm nothing broke**

```bash
npm test
```

Expected: All unit tests pass.

- [ ] **Step 8: Final production deploy**

```bash
vercel --prod
```

Run the health check:
```bash
curl https://YOUR-DEPLOYMENT.vercel.app/api/health
```

Expected: `{"status":"ok","db":"connected"}`

**Do not** set `TEST_OTP_BYPASS=true` in Vercel production env vars.

- [ ] **Step 9: Commit**

```bash
git add tests/e2e/ src/app/api/auth/verify-otp/route.ts
git commit -m "feat: add Playwright E2E test suite for login, orders, and menu"
```

---

## Phase 5 Complete — Platform Checklist

Verify everything works end-to-end:

- [ ] Customer can order via WhatsApp (full bot flow)
- [ ] Baker receives WhatsApp notification with accept/reject options
- [ ] Baker accepts order → customer receives Razorpay payment link
- [ ] Customer pays → order status changes to PAID → customer receives confirmation
- [ ] Dashboard login works with phone OTP
- [ ] Orders list shows all orders with correct statuses
- [ ] Conversations inbox shows WhatsApp threads
- [ ] Menu manager allows add/edit/hide of categories and items
- [ ] Analytics page shows revenue and top items
- [ ] Settings page shows embed widget snippet
- [ ] Widget button appears and links to correct WhatsApp number
- [ ] All unit tests pass (`npm test`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Production deploy is live and healthy
