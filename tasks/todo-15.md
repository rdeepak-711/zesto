# Task 15 — Orders List Page (Accept/Reject Buttons)

**Phase:** 3 — Dashboard  
**Goal:** The main dashboard page showing all orders. Baker can accept or reject pending orders with one click.

**Files created:**
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/orders/page.tsx`
- `src/app/api/orders/route.ts`
- `src/app/api/orders/[id]/accept/route.ts`
- `src/app/api/orders/[id]/reject/route.ts`
- `tests/api/orders.test.ts`

---

- [ ] **Step 1: Write the orders API failing tests**

Create `tests/api/orders.test.ts`:

```typescript
import { GET } from '@/app/api/orders/route'
import { PATCH as acceptOrder } from '@/app/api/orders/[id]/accept/route'
import { PATCH as rejectOrder } from '@/app/api/orders/[id]/reject/route'

const mockFindMany = vi.fn()
const mockUpdate = vi.fn()
const mockFindUnique = vi.fn()
const mockSendWhatsApp = vi.fn().mockResolvedValue('SM123')
const mockMessageCreate = vi.fn().mockResolvedValue({})

vi.mock('@/lib/db', () => ({
  db: {
    order: { findMany: mockFindMany, update: mockUpdate, findUnique: mockFindUnique },
    message: { create: mockMessageCreate },
  },
}))
vi.mock('@/lib/twilio', () => ({ sendWhatsApp: mockSendWhatsApp }))
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ phone: '+910000000000', role: 'baker' }),
}))

const pendingOrder = {
  id: 'order-1',
  customerPhone: '+911234567890',
  customerName: '+911234567890',
  status: 'PENDING',
  totalAmount: 80000,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [{ id: 'oi-1', name: 'Choc Cake', quantity: 1, price: 80000 }],
}

describe('GET /api/orders', () => {
  it('returns list of orders', async () => {
    mockFindMany.mockResolvedValue([pendingOrder])
    const res = await GET(new Request('http://localhost/api/orders'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.orders).toHaveLength(1)
    expect(body.orders[0].id).toBe('order-1')
  })
})

describe('PATCH /api/orders/[id]/accept', () => {
  it('updates order status to ACCEPTED', async () => {
    mockFindUnique.mockResolvedValue(pendingOrder)
    mockUpdate.mockResolvedValue({ ...pendingOrder, status: 'ACCEPTED' })
    const req = new Request('http://localhost/api/orders/order-1/accept', { method: 'PATCH' })
    const res = await acceptOrder(req, { params: Promise.resolve({ id: 'order-1' }) })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) })
    )
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown order', async () => {
    mockFindUnique.mockResolvedValue(null)
    const req = new Request('http://localhost/api/orders/bad-id/accept', { method: 'PATCH' })
    const res = await acceptOrder(req, { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/orders/[id]/reject', () => {
  it('updates order status to REJECTED and notifies customer', async () => {
    mockFindUnique.mockResolvedValue(pendingOrder)
    mockUpdate.mockResolvedValue({ ...pendingOrder, status: 'REJECTED' })
    const req = new Request('http://localhost/api/orders/order-1/reject', { method: 'PATCH' })
    const res = await rejectOrder(req, { params: Promise.resolve({ id: 'order-1' }) })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) })
    )
    expect(mockSendWhatsApp).toHaveBeenCalledWith('+911234567890', expect.stringContaining("couldn't accept"))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
npm test tests/api/orders.test.ts
```

Expected: FAIL — routes don't exist.

- [ ] **Step 3: Write `src/app/api/orders/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const orders = await db.order.findMany({
    where: status ? { status: status as never } : undefined,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ orders })
}
```

- [ ] **Step 4: Write `src/app/api/orders/[id]/accept/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { orderRejectedMessage } from '@/bot/messages'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const order = await db.order.findUnique({ where: { id }, include: { items: true } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.order.update({
    where: { id },
    data: { status: 'ACCEPTED' },
  })

  // Payment link is sent in Task 20 (createPaymentLink). 
  // This route just marks it accepted — the Razorpay route handles the link.

  return NextResponse.json({ order: updated })
}
```

- [ ] **Step 5: Write `src/app/api/orders/[id]/reject/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/twilio'
import { orderRejectedMessage } from '@/bot/messages'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.order.update({
    where: { id },
    data: { status: 'REJECTED' },
  })

  await sendWhatsApp(order.customerPhone, orderRejectedMessage())
  await db.message.create({
    data: {
      customerPhone: order.customerPhone,
      body: orderRejectedMessage(),
      direction: 'OUT',
      orderId: order.id,
    },
  })

  return NextResponse.json({ order: updated })
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test tests/api/orders.test.ts
```

Expected: `4 passed`.

- [ ] **Step 7: Write `src/app/(dashboard)/layout.tsx`**

```tsx
import Link from 'next/link'
import { LayoutDashboard, ShoppingBag, MessageSquare, BarChart3, UtensilsCrossed, Settings, LogOut } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-56 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <span className="font-bold text-lg">Zesto</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 w-full transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
```

Add lucide-react:
```bash
npm install lucide-react
```

- [ ] **Step 8: Write `src/app/(dashboard)/page.tsx`** (home/summary)

```tsx
import { db } from '@/lib/db'
import { paiseToCurrency } from '@/lib/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function DashboardHome() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [pendingCount, todayOrders] = await Promise.all([
    db.order.count({ where: { status: 'PENDING' } }),
    db.order.findMany({
      where: { createdAt: { gte: today }, status: { in: ['PAID', 'COMPLETED', 'ACCEPTED'] } },
    }),
  ])

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Today's Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{paiseToCurrency(todayRevenue)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Write `src/app/(dashboard)/orders/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { paiseToCurrency } from '@/lib/currency'

type Order = {
  id: string
  customerPhone: string
  status: string
  totalAmount: number
  createdAt: string
  items: { name: string; quantity: number; price: number }[]
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-orange-100 text-orange-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  PAID: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-slate-100 text-slate-700',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  async function loadOrders() {
    const res = await fetch('/api/orders')
    const data = await res.json()
    setOrders(data.orders)
    setLoading(false)
  }

  useEffect(() => { loadOrders() }, [])

  async function handleAccept(id: string) {
    await fetch(`/api/orders/${id}/accept`, { method: 'PATCH' })
    loadOrders()
  }

  async function handleReject(id: string) {
    await fetch(`/api/orders/${id}/reject`, { method: 'PATCH' })
    loadOrders()
  }

  if (loading) return <p className="text-slate-500">Loading orders…</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Orders</h1>
      {orders.length === 0 && <p className="text-slate-500">No orders yet.</p>}
      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{order.customerPhone}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status] ?? ''}`}>
                    {order.status}
                  </span>
                </div>
                <div className="text-sm text-slate-500 space-y-0.5">
                  {order.items.map((item, i) => (
                    <div key={i}>{item.quantity}× {item.name}</div>
                  ))}
                </div>
                <div className="mt-2 font-semibold">{paiseToCurrency(order.totalAmount)}</div>
              </div>
              {order.status === 'PENDING' && (
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleAccept(order.id)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(order.id)}>Reject</Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 10: Verify in browser**

```bash
npm run dev
```

Login at `http://localhost:3000/login` (use your real baker phone to get an OTP via WhatsApp). Then go to `http://localhost:3000/orders`. Expected: order list with Accept/Reject buttons on PENDING orders.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/orders/ src/app/\(dashboard\)/ tests/api/orders.test.ts
git commit -m "feat: orders list page with accept/reject, dashboard layout"
```
