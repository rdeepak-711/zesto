import { db } from '@/lib/db'

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`
}

export default async function AnalyticsPage() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [totalOrders, paidOrders, pendingOrders, revenueAgg, topItems, recentOrders] =
    await Promise.all([
      db.order.count(),
      db.order.count({ where: { status: { in: ['PAID', 'COMPLETED'] } } }),
      db.order.count({ where: { status: 'PENDING' } }),
      db.order.aggregate({
        where: { status: { in: ['PAID', 'COMPLETED'] } },
        _sum: { totalAmount: true },
      }),
      db.orderItem.groupBy({
        by: ['name'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      db.order.findMany({
        where: { status: { in: ['PAID', 'COMPLETED'] }, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true, totalAmount: true },
      }),
    ])

  const dailyRevenue: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dailyRevenue[d.toISOString().slice(0, 10)] = 0
  }
  for (const order of recentOrders) {
    const day = order.createdAt.toISOString().slice(0, 10)
    if (dailyRevenue[day] !== undefined) dailyRevenue[day] += order.totalAmount
  }

  const dailyData = Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount }))
  const maxDaily = Math.max(...dailyData.map((d) => d.amount), 1)

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Orders', value: totalOrders },
          { label: 'Paid Orders', value: paidOrders },
          { label: 'Pending', value: pendingOrders },
          { label: 'Total Revenue', value: formatPrice(revenueAgg._sum.totalAmount ?? 0) },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Revenue — Last 7 Days</h2>
          <div className="flex items-end gap-2 h-32">
            {dailyData.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-orange-400 rounded-t-sm min-h-[2px]"
                  style={{ height: `${(d.amount / maxDaily) * 100}%` }}
                />
                <span className="text-xs text-gray-400">
                  {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top items */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Top Selling Items</h2>
          {topItems.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {topItems.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate max-w-[180px]">{item.name}</span>
                  <span className="text-sm font-semibold text-gray-900 ml-2">
                    {item._sum.quantity ?? 0} sold
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
