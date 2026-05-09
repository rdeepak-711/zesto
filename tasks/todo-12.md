# Task 12 — Auth API (send-otp, verify-otp, logout)

**Phase:** 3 — Dashboard  
**Goal:** Three API routes that handle baker login. send-otp SMSes a code; verify-otp checks it and sets a JWT cookie; logout clears the cookie.

**Files created:**
- `src/lib/auth.ts`
- `src/app/api/auth/send-otp/route.ts`
- `src/app/api/auth/verify-otp/route.ts`
- `src/app/api/auth/logout/route.ts`
- `tests/api/auth.test.ts`

---

- [ ] **Step 1: Write `src/lib/auth.ts`**

```typescript
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'zesto_session'
const JWT_SECRET = process.env.JWT_SECRET!

export interface SessionPayload {
  phone: string
  role: 'baker'
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload
  } catch {
    return null
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = signToken(payload)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/api/auth.test.ts`:

```typescript
import { POST as sendOtp } from '@/app/api/auth/send-otp/route'
import { POST as verifyOtp } from '@/app/api/auth/verify-otp/route'
import { DELETE as logout } from '@/app/api/auth/logout/route'

const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()
const mockSendWhatsApp = vi.fn().mockResolvedValue('SM123')

vi.mock('@/lib/db', () => ({
  db: {
    bakeryConfig: { findUnique: mockFindUnique },
    otpSession: { create: mockCreate, findFirst: mockFindFirst, update: mockUpdate },
  },
}))
vi.mock('@/lib/twilio', () => ({ sendWhatsApp: mockSendWhatsApp }))
vi.mock('@/lib/otp', () => ({
  generateOtp: () => '123456',
  hashOtp: async (otp: string) => `hashed:${otp}`,
  verifyOtp: async (otp: string, hash: string) => hash === `hashed:${otp}`,
}))
vi.mock('next/headers', () => ({
  cookies: () => ({
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  }),
}))

describe('POST /api/auth/send-otp', () => {
  it('sends OTP to registered baker phone', async () => {
    mockFindUnique.mockResolvedValue({ bakerPhone: '+911234567890' })
    mockCreate.mockResolvedValue({})
    const req = new Request('http://localhost/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '+911234567890' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await sendOtp(req)
    expect(res.status).toBe(200)
    expect(mockSendWhatsApp).toHaveBeenCalledWith('+911234567890', expect.stringContaining('123456'))
  })

  it('returns 401 if phone is not the baker phone', async () => {
    mockFindUnique.mockResolvedValue({ bakerPhone: '+910000000000' })
    const req = new Request('http://localhost/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '+919999999999' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await sendOtp(req)
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/verify-otp', () => {
  it('returns 200 and sets cookie for valid OTP', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'otp-1',
      phone: '+911234567890',
      codeHash: 'hashed:123456',
      expiresAt: new Date(Date.now() + 60000),
      used: false,
    })
    mockUpdate.mockResolvedValue({})
    const req = new Request('http://localhost/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '+911234567890', code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await verifyOtp(req)
    expect(res.status).toBe(200)
  })

  it('returns 401 for invalid OTP', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'otp-1',
      phone: '+911234567890',
      codeHash: 'hashed:123456',
      expiresAt: new Date(Date.now() + 60000),
      used: false,
    })
    const req = new Request('http://localhost/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '+911234567890', code: '999999' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await verifyOtp(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 for expired OTP', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'otp-1',
      phone: '+911234567890',
      codeHash: 'hashed:123456',
      expiresAt: new Date(Date.now() - 1000),
      used: false,
    })
    const req = new Request('http://localhost/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '+911234567890', code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await verifyOtp(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 3: Run to verify failures**

```bash
npm test tests/api/auth.test.ts
```

Expected: FAIL — routes don't exist yet.

- [ ] **Step 4: Write `src/app/api/auth/send-otp/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateOtp, hashOtp } from '@/lib/otp'
import { sendWhatsApp } from '@/lib/twilio'

export async function POST(request: Request) {
  const { phone } = await request.json()

  const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })
  if (!config || config.bakerPhone !== phone) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const otp = generateOtp()
  const codeHash = await hashOtp(otp)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await db.otpSession.create({
    data: { phone, codeHash, expiresAt },
  })

  await sendWhatsApp(phone, `Your Zesto login code: *${otp}*\nExpires in 10 minutes.`)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Write `src/app/api/auth/verify-otp/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyOtp } from '@/lib/otp'
import { setSessionCookie } from '@/lib/auth'

export async function POST(request: Request) {
  const { phone, code } = await request.json()

  const otpRecord = await db.otpSession.findFirst({
    where: { phone, used: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!otpRecord) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
  }

  if (otpRecord.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Code expired' }, { status: 401 })
  }

  const valid = await verifyOtp(code, otpRecord.codeHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  await db.otpSession.update({ where: { id: otpRecord.id }, data: { used: true } })
  await setSessionCookie({ phone, role: 'baker' })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Write `src/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function DELETE() {
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test tests/api/auth.test.ts
```

Expected: `5 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ tests/api/auth.test.ts
git commit -m "feat: add phone OTP auth API (send, verify, logout)"
```
