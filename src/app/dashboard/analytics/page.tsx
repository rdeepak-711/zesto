import { db } from '@/lib/db'

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

function formatHour(h: number) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

export default async function AnalyticsPage() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    totalOrders,
    paidOrders,
    pendingOrders,
    revenueAgg,
    topItems,
    allCustomers,
    feedbackRows,
    recentOrders,
    allPaidOrders,
  ] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: { in: ['PAID', 'COMPLETED'] } } }),
    db.order.count({ where: { status: 'PENDING' } }),
    db.order.aggregate({
      where: { status: { in: ['PAID', 'COMPLETED'] } },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    }),
    db.orderItem.groupBy({
      by: ['name'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 8,
    }),
    db.order.groupBy({ by: ['customerPhone'], _count: { id: true } }),
    db.orderFeedback.aggregate({ _avg: { rating: true }, _count: { rating: true } }),
    db.order.findMany({
      where: { status: { in: ['PAID', 'COMPLETED'] }, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, totalAmount: true },
    }),
    db.order.findMany({
      where: { status: { in: ['PAID', 'COMPLETED'] } },
      select: { createdAt: true },
    }),
  ])

  // Daily revenue — last 30 days
  const dailyRevenue: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dailyRevenue[d.toISOString().slice(0, 10)] = 0
  }
  for (const o of recentOrders) {
    const day = o.createdAt.toISOString().slice(0, 10)
    if (dailyRevenue[day] !== undefined) dailyRevenue[day] += o.totalAmount
  }
  const dailyData = Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount }))
  const maxDaily = Math.max(...dailyData.map(d => d.amount), 1)

  // Peak hours — group 24h, show 7am–11pm
  const hourCounts: number[] = Array(24).fill(0)
  for (const o of allPaidOrders) hourCounts[new Date(o.createdAt).getHours()]++
  const peakHours = hourCounts.map((count, hour) => ({ hour, count })).slice(7, 23)
  const maxHour = Math.max(...peakHours.map(h => h.count), 1)
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

  // Repeat rate
  const repeatCustomers = allCustomers.filter(c => c._count.id >= 2).length
  const totalCustomers = allCustomers.length
  const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0

  const revenue = revenueAgg._sum.totalAmount ?? 0
  const aov = revenueAgg._avg.totalAmount ?? 0
  const avgRating = feedbackRows._avg.rating

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Analytics</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Last 30 days</span>
      </div>

      <div className="p-8 space-y-5">
        {/* Stat cards — row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[
            { label: 'Total Orders', value: String(totalOrders), icon: '🛍️', bg: 'bg-orange-50', sub: `${paidOrders} paid` },
            { label: 'Total Revenue', value: formatPrice(revenue), icon: '💰', bg: 'bg-emerald-50', sub: `avg ${formatPrice(aov)} / order` },
            { label: 'Repeat Rate', value: `${repeatRate}%`, icon: '🔁', bg: 'bg-blue-50', sub: `${repeatCustomers} of ${totalCustomers} customers` },
            {
              label: 'Avg Rating',
              value: avgRating ? `${avgRating.toFixed(1)} ⭐` : '—',
              icon: '💬',
              bg: 'bg-amber-50',
              sub: feedbackRows._count.rating > 0 ? `${feedbackRows._count.rating} reviews` : 'No reviews yet',
            },
          ].map(card => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-3.5">
              <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs text-gray-400 font-medium">{card.label}</div>
                <div className="text-2xl font-extrabold text-gray-900 mt-1 leading-none">{card.value}</div>
                <div className="text-[11px] text-gray-400 mt-1">{card.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue chart — 30 days */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-sm font-semibold text-gray-900">Revenue — Last 30 Days</div>
          <div className="text-xs text-gray-400 mt-0.5 mb-5">Daily revenue (paid + completed orders)</div>
          <div className="flex items-end gap-1 h-28">
            {dailyData.map((d, i) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  title={`${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${formatPrice(d.amount)}`}
                  className="w-full bg-orange-400 hover:bg-orange-500 rounded-t-sm min-h-[2px] transition-colors cursor-default"
                  style={{ height: `${(d.amount / maxDaily) * 100}%` }}
                />
                {(i === 0 || i === 14 || i === 29) && (
                  <span className="text-[9px] text-gray-400">
                    {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top items */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm font-semibold text-gray-900">Top Items</div>
            <div className="text-xs text-gray-400 mt-0.5 mb-4">By units sold</div>
            {topItems.length === 0 ? (
              <p className="text-sm text-gray-400">No data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {topItems.map((item, i) => {
                  const max = topItems[0]._sum.quantity ?? 1
                  const pct = Math.round(((item._sum.quantity ?? 0) / max) * 100)
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-700 truncate flex-1">{item.name}</span>
                        <span className="text-xs font-bold text-gray-900 ml-2">{item._sum.quantity ?? 0}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div
                          className={`h-full rounded-full ${i === 0 ? 'bg-orange-500' : 'bg-orange-200'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Peak hours */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm font-semibold text-gray-900">Peak Order Hours</div>
            <div className="text-xs text-gray-400 mt-0.5 mb-4">
              Busiest: {formatHour(peakHour)}
            </div>
            <div className="flex items-end gap-0.5 h-24">
              {peakHours.map(({ hour, count }) => (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    title={`${formatHour(hour)}: ${count} orders`}
                    className="w-full bg-blue-400 hover:bg-blue-500 rounded-t-sm min-h-[2px] transition-colors cursor-default"
                    style={{ height: `${(count / maxHour) * 100}%` }}
                  />
                  {hour % 4 === 0 && (
                    <span className="text-[9px] text-gray-400">{formatHour(hour)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="text-sm font-semibold text-gray-900">Quick Stats</div>
            {[
              { label: 'Pending orders', value: String(pendingOrders) },
              { label: 'Total customers', value: String(totalCustomers) },
              { label: 'Repeat customers', value: String(repeatCustomers) },
              { label: 'Avg order value', value: formatPrice(aov) },
              { label: 'Ratings received', value: String(feedbackRows._count.rating) },
            ].map(stat => (
              <div key={stat.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{stat.label}</span>
                <span className="text-sm font-bold text-gray-900">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
