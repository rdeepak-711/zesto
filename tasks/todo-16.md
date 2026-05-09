# Task 16 — Order Detail Page

**Phase:** 3 — Dashboard  
**Goal:** A page showing full order details — customer phone, all items with quantities, total, status history timeline, and payment link if generated.

**Files created:**
- `src/app/(dashboard)/orders/[id]/page.tsx`

---

- [ ] **Step 1: Write `src/app/(dashboard)/orders/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { paiseToCurrency } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-orange-100 text-orange-700 border-orange-200',
  ACCEPTED: 'bg-blue-100 text-blue-700 border-blue-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  PAID: 'bg-green-100 text-green-700 border-green-200',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!order) notFound()

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/orders" className="text-slate-500 hover:text-slate-700 text-sm">
          ← Orders
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-700 font-mono">{order.id.slice(0, 8)}…</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLOR[order.status] ?? ''}`}>
          {order.status}
        </span>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            <p>{order.customerPhone}</p>
            <p className="text-slate-400 mt-1">
              {new Date(order.createdAt).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.quantity}× {item.name}</span>
                  <span className="text-slate-500">{paiseToCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>{paiseToCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {order.paymentLinkUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Link</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={order.paymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline break-all"
              >
                {order.paymentLinkUrl}
              </a>
            </CardContent>
          </Card>
        )}

        {order.messages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {order.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-xs p-2 rounded ${
                      msg.direction === 'IN'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-green-50 text-green-800 text-right'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    <p className="text-slate-400 mt-1">
                      {msg.direction === 'IN' ? 'Customer' : 'Bot'} ·{' '}
                      {new Date(msg.createdAt).toLocaleTimeString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the page renders**

```bash
npm run dev
```

Navigate to `/orders`, click any order (you'll need the order ID — add a link from the orders page: wrap each order in a `<Link href={`/orders/${order.id}`}>` if you haven't already).

Expected: Full order detail with items, total, and message thread.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: add order detail page with items and message thread"
```
