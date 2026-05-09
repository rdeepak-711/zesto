import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendWhatsApp } from '@/lib/twilio'
import Link from 'next/link'

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

async function acceptOrder(orderId: string) {
  'use server'
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'PENDING') return

  await db.order.update({
    where: { id: orderId },
    data: { status: 'ACCEPTED', bakerNotifiedAt: new Date() },
  })

  await sendWhatsApp(
    order.customerPhone,
    `🎉 Your order has been accepted! The baker will prepare it shortly.\n\nWe'll notify you when it's ready. Thank you!`
  )

  revalidatePath(`/dashboard/orders/${orderId}`)
  redirect('/dashboard')
}

async function rejectOrder(orderId: string) {
  'use server'
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'PENDING') return

  await db.order.update({ where: { id: orderId }, data: { status: 'REJECTED' } })

  await sendWhatsApp(
    order.customerPhone,
    `We're sorry, your order could not be processed at this time. Please try again later.`
  )

  revalidatePath(`/dashboard/orders/${orderId}`)
  redirect('/dashboard')
}

async function completeOrder(orderId: string) {
  'use server'
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order || order.status !== 'ACCEPTED') return

  await db.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } })

  await sendWhatsApp(
    order.customerPhone,
    `✅ Your order #${order.id.slice(0, 8).toUpperCase()} is ready! Thank you for choosing us 🎂`
  )

  revalidatePath(`/dashboard/orders/${orderId}`)
  redirect('/dashboard')
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true },
  })

  if (!order) notFound()

  const acceptWithId = acceptOrder.bind(null, id)
  const rejectWithId = rejectOrder.bind(null, id)
  const completeWithId = completeOrder.bind(null, id)

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          ← Orders
        </Link>
        <span className="text-gray-200">|</span>
        <h1 className="text-lg font-semibold text-gray-900">
          Order #{order.id.slice(0, 8).toUpperCase()}
        </h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
          {order.status}
        </span>
      </div>

      {/* Customer */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Customer</h2>
        <p className="text-sm text-gray-900">{order.customerName}</p>
        <p className="text-sm text-gray-500">{order.customerPhone}</p>
        <p className="text-xs text-gray-400 mt-2">{order.createdAt.toLocaleString('en-IN')}</p>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Items</h2>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.name} × {item.quantity}</span>
              <span className="text-gray-900 font-medium">{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.totalAmount)}</span>
        </div>
      </div>

      {/* Actions */}
      {order.status === 'PENDING' && (
        <div className="flex gap-3">
          <form action={acceptWithId} className="flex-1">
            <button
              type="submit"
              className="w-full bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 text-sm font-medium transition-colors"
            >
              Accept Order
            </button>
          </form>
          <form action={rejectWithId} className="flex-1">
            <button
              type="submit"
              className="w-full bg-red-100 hover:bg-red-200 text-red-700 rounded-xl py-3 text-sm font-medium transition-colors"
            >
              Reject Order
            </button>
          </form>
        </div>
      )}

      {order.status === 'ACCEPTED' && (
        <form action={completeWithId}>
          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            Mark as Completed
          </button>
        </form>
      )}
    </div>
  )
}
