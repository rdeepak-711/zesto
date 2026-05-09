# Task 24 — Analytics Dashboard Page (Charts)

**Phase:** 5 — Analytics + Widget  
**Goal:** Display the analytics summary as a set of metric cards and a simple revenue bar chart.

**Files created:**
- `src/app/(dashboard)/analytics/page.tsx`

---

- [ ] **Step 1: Install a lightweight chart library**

```bash
npm install recharts
```

- [ ] **Step 2: Write `src/app/(dashboard)/analytics/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { paiseToCurrency } from '@/lib/currency'

type Summary = {
  totalOrders: number
  paidOrders: number
  totalRevenue: number
  conversionRate: number
  topItems: { name: string; quantity: number }[]
  dailyData: { date: string; orders: number; revenue: number }[]
}

const PERIODS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
]

export default function AnalyticsPage() {
  const [data, setData] = useState<Summary | null>(null)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    fetch(`/api/analytics/summary?days=${period}`)
      .then((r) => r.json())
      .then(setData)
  }, [period])

  if (!data) return <p className="text-slate-500">Loading analytics…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{paiseToCurrency(data.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">Paid Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{data.paidOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.conversionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Daily Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          {data.dailyData.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.dailyData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(v) => `₹${(v / 100).toFixed(0)}`}
                  tick={{ fontSize: 11 }}
                  width={50}
                />
                <Tooltip
                  formatter={(value: number) => [paiseToCurrency(value), 'Revenue']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                />
                <Bar dataKey="revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top items */}
      {data.topItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topItems.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-slate-500">{item.quantity} sold</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div
                        className="h-1.5 bg-green-500 rounded-full"
                        style={{ width: `${(item.quantity / data.topItems[0].quantity) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000/analytics`. Expected: 4 metric cards, revenue bar chart (empty if no orders yet), top items list.

If you've completed the E2E test from Task 22, the charts will have real data.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/analytics/page.tsx"
git commit -m "feat: analytics page with revenue chart and top items"
```
