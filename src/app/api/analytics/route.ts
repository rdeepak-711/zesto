import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tid = auth.tenantId
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    totalOrders,
    paidOrders,
    pendingOrders,
    revenueAgg,
    topItems,
    allCompletedOrders,
    feedbackRows,
    recentOrdersRaw,
  ] = await Promise.all([
    db.order.count({ where: { tenantId: tid } }),
    db.order.count({ where: { tenantId: tid, status: { in: ['PAID', 'COMPLETED'] } } }),
    db.order.count({ where: { tenantId: tid, status: 'PENDING' } }),
    db.order.aggregate({
      where: { tenantId: tid, status: { in: ['PAID', 'COMPLETED'] } },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    }),
    db.orderItem.groupBy({
      by: ['name'],
      where: { order: { tenantId: tid } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 8,
    }),
    db.order.groupBy({
      by: ['customerPhone'],
      where: { tenantId: tid },
      _count: { id: true },
    }),
    db.orderFeedback.aggregate({
      where: { order: { tenantId: tid } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    db.order.findMany({
      where: {
        tenantId: tid,
        status: { in: ['PAID', 'COMPLETED'] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true, totalAmount: true },
    }),
  ])

  // Daily revenue — last 30 days
  const dailyRevenue: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dailyRevenue[d.toISOString().slice(0, 10)] = 0
  }
  for (const order of recentOrdersRaw) {
    const day = order.createdAt.toISOString().slice(0, 10)
    if (dailyRevenue[day] !== undefined) dailyRevenue[day] += order.totalAmount
  }

  // Peak hour — count orders by hour of day
  const allOrders = await db.order.findMany({
    where: { tenantId: tid, status: { in: ['PAID', 'COMPLETED'] } },
    select: { createdAt: true },
  })
  const hourCounts: number[] = Array(24).fill(0)
  for (const o of allOrders) {
    hourCounts[new Date(o.createdAt).getHours()]++
  }

  // Repeat customer rate
  const repeatCount = allCompletedOrders.filter(r => r._count.id >= 2).length
  const totalCustomers = allCompletedOrders.length
  const repeatRate = totalCustomers > 0 ? Math.round((repeatCount / totalCustomers) * 100) : 0

  return NextResponse.json({
    totalOrders,
    paidOrders,
    pendingOrders,
    totalRevenue: revenueAgg._sum.totalAmount ?? 0,
    avgOrderValue: revenueAgg._avg.totalAmount ?? 0,
    repeatRate,
    totalCustomers,
    avgRating: feedbackRows._avg.rating ?? 0,
    ratingCount: feedbackRows._count.rating,
    topItems: topItems.map(i => ({ name: i.name, quantity: i._sum.quantity ?? 0 })),
    dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount })),
    peakHours: hourCounts.map((count, hour) => ({ hour, count })),
  })
}
