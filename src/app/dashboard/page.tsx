import { db } from '@/lib/db'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  PAID: 'Paid',
  COMPLETED: 'Completed',
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  PAID: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-gray-100 text-gray-600',
}

const STATUS_ACCENT: Record<string, string> = {
  PENDING: 'bg-amber-400',
  ACCEPTED: 'bg-emerald-400',
  REJECTED: 'bg-red-400',
  PAID: 'bg-blue-400',
  COMPLETED: 'bg-gray-300',
}

const STATUS_ICON: Record<string, string> = {
  PENDING: '⏳',
  ACCEPTED: '✓',
  REJECTED: '✕',
  PAID: '💰',
  COMPLETED: '✓',
}

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const statusFilter = params.status?.toUpperCase()

  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where: statusFilter ? { status: statusFilter as never } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: { take: 2 } },
    }),
    db.order.groupBy({ by: ['status'], _count: true }),
  ])

  const countMap: Record<string, number> = {}
  for (const c of counts) countMap[c.status] = c._count
  const totalCount = Object.values(countMap).reduce((a, b) => a + b, 0)

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Orders</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {totalCount} total
        </span>
      </div>

      <div className="p-8">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(['', 'PENDING', 'ACCEPTED', 'PAID', 'COMPLETED', 'REJECTED'] as const).map((s) => {
            const active = (statusFilter ?? '') === s
            const count = s ? countMap[s] : totalCount
            return (
              <Link
                key={s}
                href={s ? `?status=${s.toLowerCase()}` : '/dashboard'}
                className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg border font-medium transition-colors ${
                  active
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {s ? STATUS_LABELS[s] : 'All'}
                {count != null && count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0 rounded-full font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Order cards */}
        {orders.length === 0 ? (
          <div className="text-center text-gray-400 py-16 text-sm">No orders found.</div>
        ) : (
          <div className="space-y-2.5">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/dashboard/orders/${order.id}`}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden flex hover:shadow-md transition-shadow"
              >
                <div className={`w-1 flex-shrink-0 ${STATUS_ACCENT[order.status] ?? 'bg-gray-200'}`} />
                <div className="flex-1 px-5 py-4 flex items-center gap-5">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{order.customerPhone}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500">
                      {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      {order.items.length > 0 && ` · ${order.items.map((i) => i.name).join(', ')}`}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 mt-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_BADGE[order.status]}`}
                    >
                      {STATUS_ICON[order.status]} {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-base font-bold text-gray-900">
                      {formatPrice(order.totalAmount)}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {order.createdAt.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
