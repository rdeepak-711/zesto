import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import PayButton from './PayButton'

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) notFound()

  const tenant = order.tenantId
    ? await db.tenant.findUnique({ where: { id: order.tenantId } })
    : null

  const alreadyPaid = order.status === 'PAID' || order.status === 'COMPLETED'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Business header */}
        <div className="text-center mb-8">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.businessName} className="w-16 h-16 rounded-2xl mx-auto mb-3 object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-3xl mx-auto mb-3">🛍️</div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{tenant?.businessName ?? 'Store'}</h1>
          <p className="text-sm text-gray-500 mt-1">Complete your payment</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
              config={{
                bakeryName: tenant?.businessName ?? 'Store',
                logoUrl: tenant?.logoUrl ?? null,
                razorpayKeyId: tenant?.razorpayKeyId ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
              }}
            />
          )}
        </div>

        {tenant?.whatsappNumber && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Having trouble?{' '}
            <a
              href={`https://wa.me/${tenant.whatsappNumber.replace('+', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              Contact us on WhatsApp
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
