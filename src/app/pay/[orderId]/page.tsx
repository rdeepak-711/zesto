import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import PayButton from './PayButton'

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const [order, config] = await Promise.all([
    db.order.findUnique({ where: { id: orderId } }),
    db.bakeryConfig.findUnique({ where: { id: 1 } }),
  ])

  if (!order) notFound()

  const alreadyPaid = order.status === 'PAID' || order.status === 'COMPLETED'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Bakery header */}
        <div className="text-center mb-8">
          {config?.logoUrl ? (
            <img src={config.logoUrl} alt={config.bakeryName} className="w-16 h-16 rounded-2xl mx-auto mb-3 object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-3xl mx-auto mb-3">🎂</div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{config?.bakeryName ?? 'Bakery'}</h1>
          <p className="text-sm text-gray-500 mt-1">Complete your payment</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="mb-5">
            <p className="text-sm text-gray-500">Paying for</p>
            <p className="font-semibold text-gray-900">{order.customerName}</p>
          </div>

          {order.status === 'REJECTED' ? (
            <div className="text-center py-6">
              <p className="text-red-600 font-semibold">This order was rejected.</p>
              <p className="text-gray-500 text-sm mt-1">Please contact us for assistance.</p>
            </div>
          ) : order.status === 'PENDING' ? (
            <div className="text-center py-6">
              <p className="text-amber-600 font-semibold">Order is pending review</p>
              <p className="text-gray-500 text-sm mt-1">Payment will be available once the baker accepts your order.</p>
            </div>
          ) : alreadyPaid ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-emerald-700 font-bold text-lg">Already Paid</p>
              <p className="text-gray-500 text-sm mt-1">Your payment has been received. Thank you!</p>
            </div>
          ) : (
            <PayButton
              order={{
                id: order.id,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                totalAmount: order.totalAmount,
                status: order.status,
              }}
              config={{ bakeryName: config?.bakeryName ?? 'Bakery', logoUrl: config?.logoUrl ?? null }}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Having trouble? Contact us on WhatsApp.
        </p>
      </div>
    </div>
  )
}
