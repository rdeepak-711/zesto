# Task 01 — Project Scaffold

**Phase:** 1 — Foundation  
**Goal:** Create the Next.js 15 project with TypeScript, Tailwind, shadcn/ui, Vitest, and Playwright. No logic yet — just a working shell you can open in a browser.

**Files created:**
- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `tailwind.config.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `.env.example`
- `.gitignore`

---

- [ ] **Step 1: Scaffold the Next.js app**

Run from `/Users/deepak/Documents/instagram/zesto`:

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

When prompted, accept all defaults.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install twilio razorpay jsonwebtoken bcryptjs
npm install @prisma/client
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D prisma vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom \
  @playwright/test @types/jsonwebtoken @types/bcryptjs \
  vite-tsconfig-paths
```

- [ ] **Step 4: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

Then add the components we'll need:

```bash
npx shadcn@latest add button badge card input label table tabs dialog toast select
```

- [ ] **Step 5: Write `vitest.config.ts`**

Replace the file at the project root:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 6: Write `tests/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Write `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 8: Write `.env.example`**

```env
# PlanetScale MySQL
DATABASE_URL="mysql://user:pass@host/zesto?ssl={"rejectUnauthorized":true}"

# Twilio
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="xxxxx"
TWILIO_WHATSAPP_NUMBER="whatsapp:+91xxxxxxxxxx"

# Razorpay
RAZORPAY_KEY_ID="rzp_test_xxxxx"
RAZORPAY_KEY_SECRET="xxxxx"
RAZORPAY_WEBHOOK_SECRET="xxxxx"

# Auth
JWT_SECRET="change-this-to-32-random-chars-minimum"

# App
NEXT_PUBLIC_WHATSAPP_NUMBER="+91xxxxxxxxxx"
NEXT_PUBLIC_APP_URL="https://your-deployment.vercel.app"
BAKER_PHONE="+91xxxxxxxxxx"
```

Copy to `.env.local` and fill in your values. Never commit `.env.local`.

- [ ] **Step 9: Update `.gitignore`**

Ensure these lines are present (create-next-app adds most, verify):

```
.env.local
.env*.local
.vercel
```

- [ ] **Step 10: Add test scripts to `package.json`**

Open `package.json` and add to the `"scripts"` section:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 11: Replace `src/app/page.tsx` with a placeholder**

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Zesto — coming soon</h1>
    </main>
  )
}
```

- [ ] **Step 12: Verify the dev server starts**

```bash
npm run dev
```

Expected: Server starts at `http://localhost:3000`. Open in browser — see "Zesto — coming soon".

- [ ] **Step 13: Write a smoke test to confirm Vitest works**

Create `tests/smoke.test.ts`:

```typescript
describe('smoke', () => {
  it('true is true', () => {
    expect(true).toBe(true)
  })
})
```

Run:

```bash
npm test
```

Expected output: `1 passed`.

- [ ] **Step 14: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 15 project with Tailwind, shadcn, Vitest, Playwright"
```
