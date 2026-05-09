import { db } from '@/lib/db'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  PAID: 'Paid',
  COMPLETED: 'Completed',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  PAID: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-700',
}

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const statusFilter = params.status?.toUpperCase()

  const orders = await db.order.findMany({
    where: statusFilter ? { status: statusFilter as never } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { items: true },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
        <div className="flex gap-2">
          {['', 'PENDING', 'ACCEPTED', 'PAID', 'COMPLETED', 'REJECTED'].map((s) => (
            <Link
              key={s}
              href={s ? `?status=${s.toLowerCase()}` : '/dashboard'}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                (statusFilter ?? '') === s
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {s ? STATUS_LABELS[s] : 'All'}
            </Link>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No orders found.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/orders/${order.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  #{order.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{order.customerPhone}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {formatPrice(order.totalAmount)}
                </p>
                <span
                  className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}
                >
                  {STATUS_LABELS[order.status]}
                </span>
                <p className="text-xs text-gray-400 mt-1">
                  {order.createdAt.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
