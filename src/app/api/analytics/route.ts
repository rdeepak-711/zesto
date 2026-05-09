import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'

export async function GET() {
  const auth = await getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [totalOrders, paidOrders, pendingOrders, revenueAgg, topItems] = await Promise.all([
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
  ])

  // Last 7 days revenue
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentOrders = await db.order.findMany({
    where: {
      status: { in: ['PAID', 'COMPLETED'] },
      createdAt: { gte: sevenDaysAgo },
    },
    select: { createdAt: true, totalAmount: true },
  })

  // Aggregate by day
  const dailyRevenue: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dailyRevenue[d.toISOString().slice(0, 10)] = 0
  }
  for (const order of recentOrders) {
    const day = order.createdAt.toISOString().slice(0, 10)
    if (dailyRevenue[day] !== undefined) {
      dailyRevenue[day] += order.totalAmount
    }
  }

  return NextResponse.json({
    totalOrders,
    paidOrders,
    pendingOrders,
    totalRevenue: revenueAgg._sum.totalAmount ?? 0,
    topItems: topItems.map((i) => ({ name: i.name, quantity: i._sum.quantity ?? 0 })),
    dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount })),
  })
}
