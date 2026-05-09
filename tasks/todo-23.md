# Task 23 — Analytics API (Summary Endpoint)

**Phase:** 5 — Analytics + Widget  
**Goal:** A single endpoint that returns revenue, order counts, conversion rate, and top menu items for a given date range.

**Files created:**
- `src/app/api/analytics/summary/route.ts`
- `tests/api/analytics.test.ts`

---

- [ ] **Step 1: Write the failing tests**

Create `tests/api/analytics.test.ts`:

```typescript
import { GET } from '@/app/api/analytics/summary/route'

const mockOrderFindMany = vi.fn()
const mockMessageFindMany = vi.fn()
const mockOrderItemGroupBy = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    order: { findMany: mockOrderFindMany, count: vi.fn().mockResolvedValue(0) },
    message: { findMany: mockMessageFindMany },
    orderItem: { groupBy: mockOrderItemGroupBy },
  },
}))

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/analytics/summary')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url)
}

describe('GET /api/analytics/summary', () => {
  beforeEach(() => {
    mockOrderFindMany.mockResolvedValue([])
    mockMessageFindMany.mockResolvedValue([])
    mockOrderItemGroupBy.mockResolvedValue([])
  })

  it('returns summary object with expected keys', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('totalOrders')
    expect(body).toHaveProperty('totalRevenue')
    expect(body).toHaveProperty('paidOrders')
    expect(body).toHaveProperty('conversionRate')
    expect(body).toHaveProperty('topItems')
  })

  it('calculates correct revenue from paid orders', async () => {
    mockOrderFindMany.mockResolvedValue([
      { id: 'o1', status: 'PAID', totalAmount: 80000 },
      { id: 'o2', status: 'COMPLETED', totalAmount: 50000 },
      { id: 'o3', status: 'PENDING', totalAmount: 70000 },
    ])
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.totalRevenue).toBe(130000) // Only PAID + COMPLETED
    expect(body.totalOrders).toBe(3)
    expect(body.paidOrders).toBe(2)
  })

  it('calculates conversion rate as paidOrders / totalOrders', async () => {
    mockOrderFindMany.mockResolvedValue([
      { id: 'o1', status: 'PAID', totalAmount: 80000 },
      { id: 'o2', status: 'REJECTED', totalAmount: 50000 },
      { id: 'o3', status: 'PENDING', totalAmount: 70000 },
      { id: 'o4', status: 'PAID', totalAmount: 60000 },
    ])
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.conversionRate).toBe(50) // 2/4 = 50%
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
npm test tests/api/analytics.test.ts
```

Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Write `src/app/api/analytics/summary/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Default: last 30 days
  const daysBack = parseInt(searchParams.get('days') ?? '30')
  const from = new Date()
  from.setDate(from.getDate() - daysBack)
  from.setHours(0, 0, 0, 0)

  const [orders, topItemsRaw] = await Promise.all([
    db.order.findMany({
      where: { createdAt: { gte: from } },
      select: { id: true, status: true, totalAmount: true, createdAt: true },
    }),
    db.orderItem.groupBy({
      by: ['name'],
      where: { order: { createdAt: { gte: from } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ])

  const paidStatuses = ['PAID', 'COMPLETED']
  const paidOrders = orders.filter((o) => paidStatuses.includes(o.status))
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0)
  const conversionRate =
    orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0

  // Orders per day for chart
  const ordersByDay: Record<string, { date: string; orders: number; revenue: number }> = {}
  for (const order of orders) {
    const day = order.createdAt.toISOString().split('T')[0]
    if (!ordersByDay[day]) ordersByDay[day] = { date: day, orders: 0, revenue: 0 }
    ordersByDay[day].orders++
    if (paidStatuses.includes(order.status)) {
      ordersByDay[day].revenue += order.totalAmount
    }
  }

  const topItems = topItemsRaw.map((item) => ({
    name: item.name,
    quantity: item._sum.quantity ?? 0,
  }))

  return NextResponse.json({
    totalOrders: orders.length,
    paidOrders: paidOrders.length,
    totalRevenue,
    conversionRate,
    topItems,
    dailyData: Object.values(ordersByDay).sort((a, b) => a.date.localeCompare(b.date)),
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/api/analytics.test.ts
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analytics/summary/route.ts tests/api/analytics.test.ts
git commit -m "feat: analytics summary API (revenue, orders, conversion, top items)"
```
