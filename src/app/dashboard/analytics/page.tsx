import { db } from '@/lib/db'

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

const STAT_CARDS = (
  totalOrders: number,
  revenue: number,
  pending: number,
  paid: number
) => [
  { label: 'Total Orders', value: String(totalOrders), icon: '🛍️', iconBg: 'bg-orange-50', trend: 'all time' },
  { label: 'Total Revenue', value: formatPrice(revenue), icon: '💰', iconBg: 'bg-emerald-50' },
  { label: 'Pending', value: String(pending), icon: '⏳', iconBg: 'bg-amber-50' },
  { label: 'Paid Orders', value: String(paid), icon: '✅', iconBg: 'bg-blue-50' },
]

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
  const revenue = revenueAgg._sum.totalAmount ?? 0

  const cards = STAT_CARDS(totalOrders, revenue, pendingOrders, paidOrders)

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Analytics</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Last 7 days</span>
      </div>

      <div className="p-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          {cards.map((card) => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-3.5">
              <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>
                {card.icon}
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium">{card.label}</div>
                <div className="text-2xl font-extrabold text-gray-900 mt-1 leading-none">{card.value}</div>
                {card.trend && (
                  <div className="text-[11px] text-emerald-600 font-medium mt-1">↑ {card.trend}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm font-semibold text-gray-900">Revenue — Last 7 Days</div>
            <div className="text-xs text-gray-400 mt-0.5 mb-5">Daily revenue in ₹</div>
            <div className="flex items-end gap-2 h-24">
              {dailyData.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full bg-orange-400 rounded-t-md min-h-[3px] hover:bg-orange-500 transition-colors"
                    style={{ height: `${(d.amount / maxDaily) * 100}%` }}
                  />
                  <span className="text-[10px] text-gray-400">
                    {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm font-semibold text-gray-900">Top Selling Items</div>
            <div className="text-xs text-gray-400 mt-0.5 mb-5">By units sold</div>
            {topItems.length === 0 ? (
              <p className="text-sm text-gray-400">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {topItems.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-orange-500' : 'bg-gray-200'}`}
                      />
                      <span className="text-sm text-gray-700 truncate">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 ml-2 flex-shrink-0">
                      {item._sum.quantity ?? 0} sold
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
