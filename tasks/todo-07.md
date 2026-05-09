# Task 07 — Bot Session Management (DB Read/Write)

**Phase:** 2 — WhatsApp Bot  
**Goal:** Persist bot conversation state to `bot_sessions` table. Sessions expire after 30 minutes of inactivity — expired sessions reset to IDLE.

**Files created:**
- `src/bot/session.ts`
- `tests/bot/session.test.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/bot/session.test.ts`:

```typescript
import { getSession, saveSession } from '@/bot/session'
import type { BotSessionData } from '@/types'

const mockFindUnique = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    botSession: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}))

describe('getSession', () => {
  beforeEach(() => {
    mockFindUnique.mockClear()
    mockUpsert.mockClear()
  })

  it('returns IDLE session if no record exists', async () => {
    mockFindUnique.mockResolvedValue(null)
    const session = await getSession('+911234567890')
    expect(session.state).toBe('IDLE')
    expect(session.cart).toEqual([])
  })

  it('returns existing session from DB', async () => {
    const lastActive = new Date()
    mockFindUnique.mockResolvedValue({
      customerPhone: '+911234567890',
      state: 'AWAITING_CATEGORY',
      cartJson: JSON.stringify([{ menuItemId: 'item-1', name: 'Cake', price: 80000, quantity: 1 }]),
      contextJson: JSON.stringify({ selectedCategoryId: 'cat-1' }),
      lastActive,
    })
    const session = await getSession('+911234567890')
    expect(session.state).toBe('AWAITING_CATEGORY')
    expect(session.cart).toHaveLength(1)
    expect(session.context.selectedCategoryId).toBe('cat-1')
  })

  it('returns IDLE if session is older than 30 minutes', async () => {
    const old = new Date(Date.now() - 31 * 60 * 1000)
    mockFindUnique.mockResolvedValue({
      customerPhone: '+911234567890',
      state: 'AWAITING_ITEM',
      cartJson: '[]',
      lastActive: old,
    })
    const session = await getSession('+911234567890')
    expect(session.state).toBe('IDLE')
    expect(session.cart).toEqual([])
  })
})

describe('saveSession', () => {
  it('upserts the session to the DB', async () => {
    mockUpsert.mockResolvedValue({})
    const session: BotSessionData = {
      customerPhone: '+911234567890',
      state: 'AWAITING_QUANTITY',
      cart: [],
    }
    await saveSession(session)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerPhone: '+911234567890' },
        create: expect.objectContaining({ state: 'AWAITING_QUANTITY' }),
        update: expect.objectContaining({ state: 'AWAITING_QUANTITY' }),
      })
    )
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
npm test tests/bot/session.test.ts
```

Expected: FAIL — `Cannot find module '@/bot/session'`

- [ ] **Step 3: Write `src/bot/session.ts`**

```typescript
import { db } from '@/lib/db'
import type { BotSessionData, CartItem, BotState } from '@/types'

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

function idleSession(customerPhone: string): BotSessionData {
  return { customerPhone, state: 'IDLE', cart: [] }
}

export async function getSession(customerPhone: string): Promise<BotSessionData & { context: Record<string, unknown> }> {
  const record = await db.botSession.findUnique({ where: { customerPhone } })

  if (!record) return { ...idleSession(customerPhone), context: {} }

  const isExpired = Date.now() - record.lastActive.getTime() > SESSION_TTL_MS
  if (isExpired) return { ...idleSession(customerPhone), context: {} }

  const cart = JSON.parse(record.cartJson as string) as CartItem[]
  const context = JSON.parse(record.contextJson as string ?? '{}') as Record<string, unknown>
  return {
    customerPhone,
    state: record.state as BotState,
    cart,
    context,
  }
}

export async function saveSession(session: BotSessionData & { context?: Record<string, unknown> }): Promise<void> {
  const data = {
    customerPhone: session.customerPhone,
    state: session.state,
    cartJson: JSON.stringify(session.cart),
    contextJson: JSON.stringify(session.context ?? {}),
  }
  await db.botSession.upsert({
    where: { customerPhone: session.customerPhone },
    create: data,
    update: { state: data.state, cartJson: data.cartJson, contextJson: data.contextJson },
  })
}

export async function clearSession(customerPhone: string): Promise<void> {
  await db.botSession.upsert({
    where: { customerPhone },
    create: { customerPhone, state: 'IDLE', cartJson: '[]' },
    update: { state: 'IDLE', cartJson: '[]' },
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/bot/session.test.ts
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/bot/session.ts tests/bot/session.test.ts
git commit -m "feat: add bot session management with 30-min TTL"
```
