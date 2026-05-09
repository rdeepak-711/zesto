# Task 11 — OTP Generation + Hashing Utilities

**Phase:** 3 — Dashboard  
**Goal:** Pure utility functions for generating, hashing, and verifying 6-digit OTPs. No DB or Twilio — fully unit-testable.

**Files created:**
- `src/lib/otp.ts`
- `src/lib/currency.ts`
- `tests/api/otp.test.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/api/otp.test.ts`:

```typescript
import { generateOtp, hashOtp, verifyOtp } from '@/lib/otp'

describe('generateOtp', () => {
  it('returns a 6-digit string', () => {
    const otp = generateOtp()
    expect(otp).toMatch(/^\d{6}$/)
  })

  it('generates different values each time', () => {
    const otps = new Set(Array.from({ length: 20 }, generateOtp))
    expect(otps.size).toBeGreaterThan(1)
  })
})

describe('hashOtp + verifyOtp', () => {
  it('hash is not the plain OTP', async () => {
    const hash = await hashOtp('123456')
    expect(hash).not.toBe('123456')
  })

  it('verifyOtp returns true for correct OTP', async () => {
    const otp = '654321'
    const hash = await hashOtp(otp)
    expect(await verifyOtp(otp, hash)).toBe(true)
  })

  it('verifyOtp returns false for wrong OTP', async () => {
    const hash = await hashOtp('111111')
    expect(await verifyOtp('222222', hash)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
npm test tests/api/otp.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/otp'`

- [ ] **Step 3: Write `src/lib/otp.ts`**

```typescript
import bcrypt from 'bcryptjs'

export function generateOtp(): string {
  const num = Math.floor(100000 + Math.random() * 900000)
  return num.toString()
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10)
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/api/otp.test.ts
```

Expected: `5 passed`.

- [ ] **Step 5: Write `src/lib/currency.ts`**

No tests needed — pure arithmetic. Used by the dashboard UI.

```typescript
export function paiseToCurrency(paise: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100)
}

export function currencyToPaise(amount: number): number {
  return Math.round(amount * 100)
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/otp.ts src/lib/currency.ts tests/api/otp.test.ts
git commit -m "feat: add OTP and currency utilities"
```
