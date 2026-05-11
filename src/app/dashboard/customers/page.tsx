import { db } from '@/lib/db'
import Link from 'next/link'

function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

export default async function CustomersPage() {
  const customers = await db.order.groupBy({
    by: ['customerPhone', 'customerName'],
    _count: { id: true },
    _sum: { totalAmount: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
  })

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Customers</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {customers.length}
        </span>
      </div>

      <div className="p-8">
        {customers.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            No customers yet. Orders will appear here.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Spent</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Order</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const initials = c.customerName
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                  return (
                    <tr key={c.customerPhone} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600 flex-shrink-0">
                            {initials}
                          </div>
                          <span className="font-medium text-gray-900">{c.customerName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{c.customerPhone}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-700">{c._count.id}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                        {formatPrice(c._sum.totalAmount ?? 0)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-400 text-xs">
                        {c._max.createdAt ? formatDate(c._max.createdAt) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/dashboard?phone=${encodeURIComponent(c.customerPhone)}`}
                          className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                        >
                          View orders
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
