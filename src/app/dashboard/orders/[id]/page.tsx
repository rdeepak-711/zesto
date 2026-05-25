import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendWhatsApp } from '@/lib/twilio'
import { getAuthFromCookies } from '@/lib/auth'
import Link from 'next/link'
import SendPaymentButton from './SendPaymentButton'

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PENDING:   { label: 'Pending',   bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-400' },
  ACCEPTED:  { label: 'Accepted',  bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500' },
  REJECTED:  { label: 'Rejected',  bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-400' },
  PAID:      { label: 'Paid',      bg: 'bg-emerald-50', text: 'text-emerald-700',dot: 'bg-emerald-500' },
  COMPLETED: { label: 'Completed', bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

function formatDateTime(d: Date) {
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

async function acceptOrder(orderId: string, formData: FormData) {
  'use server'
  const auth = await getAuthFromCookies()
  if (!auth) return
  const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId }, select: { whatsappNumber: true } })
  const order = await db.order.findUnique({ where: { id: orderId, tenantId: auth.tenantId } })
  if (!order || order.status !== 'PENDING') return
  const deliveryNote = (formData.get('deliveryNote') as string | null)?.trim() || order.deliveryNote || null
  await db.order.update({
    where: { id: orderId },
    data: { status: 'ACCEPTED', bakerNotifiedAt: new Date(), deliveryNote },
  })
  const deliveryLine = deliveryNote ? `\n📅 *Delivery:* ${deliveryNote}` : ''
  const from = tenant?.whatsappNumber
  if (order.totalAmount > 0) {
    const payUrl = `${APP_URL}/pay/${orderId}`
    await sendWhatsApp(
      order.customerPhone,
      `🎉 Your order has been *accepted*!${deliveryLine}\n\n💳 Please complete your payment:\n${payUrl}\n\nWe'll start preparing once payment is received.`,
      from
    )
  } else {
    await sendWhatsApp(
      order.customerPhone,
      `🎉 Your order has been *accepted*! The baker is now preparing it.${deliveryLine}\n\nType *track* anytime to check your order status. Thank you! 🎂`,
      from
    )
  }
  revalidatePath(`/dashboard/orders/${orderId}`)
  redirect('/dashboard')
}

async function rejectOrder(orderId: string) {
  'use server'
  const auth = await getAuthFromCookies()
  if (!auth) return
  const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId }, select: { whatsappNumber: true } })
  const order = await db.order.findUnique({ where: { id: orderId, tenantId: auth.tenantId } })
  if (!order || order.status !== 'PENDING') return
  await db.order.update({ where: { id: orderId }, data: { status: 'REJECTED' } })
  await sendWhatsApp(
    order.customerPhone,
    `We're sorry, your order could not be processed at this time. Please try again later.`,
    tenant?.whatsappNumber
  )
  revalidatePath(`/dashboard/orders/${orderId}`)
  redirect('/dashboard')
}

async function completeOrder(orderId: string) {
  'use server'
  const auth = await getAuthFromCookies()
  if (!auth) return
  const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId }, select: { whatsappNumber: true } })
  const order = await db.order.findUnique({ where: { id: orderId, tenantId: auth.tenantId } })
  if (!order || !['ACCEPTED', 'PAID'].includes(order.status)) return
  await db.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' } })
  const shortId = order.id.slice(0, 8).toUpperCase()
  await sendWhatsApp(
    order.customerPhone,
    `✅ Your order #${shortId} is ready! Thank you for choosing us 🎂\n\nWe'd love your feedback! Reply with a number:\n\n5 - Excellent\n4 - Good\n3 - OK\n2 - Below average\n1 - Poor`,
    tenant?.whatsappNumber
  )
  revalidatePath(`/dashboard/orders/${orderId}`)
  redirect('/dashboard')
}

async function sendPaymentLink(
  orderId: string,
  _prev: { ok: boolean; error?: string } | null,
  _formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  'use server'
  const auth = await getAuthFromCookies()
  if (!auth) return { ok: false, error: 'Unauthorized' }
  const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId }, select: { whatsappNumber: true } })
  const order = await db.order.findUnique({ where: { id: orderId, tenantId: auth.tenantId } })
  if (!order || order.status !== 'ACCEPTED' || order.totalAmount <= 0)
    return { ok: false, error: 'Order not eligible for payment' }
  const payUrl = `${APP_URL}/pay/${orderId}`
  try {
    await sendWhatsApp(
      order.customerPhone,
      `💳 Payment request for your order #${order.id.slice(0, 8).toUpperCase()}\n\nAmount: ₹${(order.totalAmount / 100).toFixed(0)}\n\nPay securely here:\n${payUrl}\n\nSupports UPI, cards, netbanking & wallets.`,
      tenant?.whatsappNumber
    )
    revalidatePath(`/dashboard/orders/${orderId}`)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Failed to send WhatsApp message' }
  }
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthFromCookies()
  if (!auth) notFound()
  const order = await db.order.findUnique({
    where: { id, tenantId: auth.tenantId },
    include: { items: { include: { menuItem: { select: { imageUrl: true } } } } },
  })
  if (!order) notFound()

  const acceptWithId = acceptOrder.bind(null, id)
  const rejectWithId = rejectOrder.bind(null, id)
  const completeWithId = completeOrder.bind(null, id)
  const sendPaymentWithId = sendPaymentLink.bind(null, id)

  const shortId = order.id.slice(0, 8).toUpperCase()
  const status = STATUS_META[order.status] ?? STATUS_META.PENDING
  const isCustom = order.items.length === 0 && !!order.notes
  const initials = order.customerName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Orders
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-base font-bold text-gray-900">Order #{shortId}</h1>
        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold border ${status.bg} ${status.text} border-current/20`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        {isCustom && (
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            ✏️ Custom
          </span>
        )}
      </div>

      {/* Order progress tracker (non-rejected, non-custom) */}
      {!isCustom && order.status !== 'REJECTED' && (
        <div className="bg-white border-b border-gray-100 px-8 py-3">
          <div className="flex items-center gap-0 max-w-lg">
            {(['PENDING', 'ACCEPTED', 'PAID', 'COMPLETED'] as const).map((s, idx, arr) => {
              const labels: Record<string, string> = { PENDING: 'Received', ACCEPTED: 'Preparing', PAID: 'Paid', COMPLETED: 'Ready' }
              const statuses = ['PENDING', 'ACCEPTED', 'PAID', 'COMPLETED']
              const currentIdx = statuses.indexOf(order.status)
              const stepIdx = statuses.indexOf(s)
              const done = stepIdx < currentIdx
              const active = stepIdx === currentIdx
              return (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      done ? 'bg-orange-500 text-white' : active ? 'bg-orange-500 text-white ring-4 ring-orange-100' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {done ? '✓' : idx + 1}
                    </div>
                    <span className={`text-[10px] font-medium whitespace-nowrap ${active ? 'text-orange-600' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                      {labels[s]}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-3.5 mx-1 ${stepIdx < currentIdx ? 'bg-orange-400' : 'bg-gray-100'}`} />
                  )}
                </div>
              )
            })}
          </div>
          {order.deliveryNote && (
            <p className="text-xs text-gray-500 mt-1.5">
              📅 <span className="font-medium">{order.deliveryNote}</span>
            </p>
          )}
        </div>
      )}

      <div className="p-8">
        <div className="grid grid-cols-[1fr_280px] gap-6 max-w-4xl">

          {/* ── Left column ─────────────────────────────── */}
          <div className="space-y-4">

            {/* Custom order notes */}
            {isCustom && order.notes && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-purple-900">Custom Request</span>
                  <span className="text-[10px] text-purple-500 font-semibold bg-purple-100 px-1.5 py-0.5 rounded-full">Price TBD</span>
                </div>
                <p className="text-sm text-purple-800 whitespace-pre-wrap leading-relaxed">{order.notes}</p>
              </div>
            )}

            {/* Items */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">
                  {isCustom ? 'Order Type' : `Items · ${order.items.length}`}
                </h2>
              </div>
              <div className="px-5 py-4">
                {isCustom ? (
                  <p className="text-sm text-gray-500">Custom order — see request above. Baker sets price on acceptance.</p>
                ) : (
                  <div className="space-y-3">
                    {order.items.map((item) => {
                      const fields: { name: string; value: string; priceDelta?: number }[] = (() => { try { return JSON.parse(item.fieldsJson || '[]') } catch { return [] } })()
                      const fieldTags = fields.filter(f => f.value)
                      const fieldDelta = fields.reduce((s, f) => s + (f.priceDelta ?? 0), 0)
                      const unitPrice = item.price + fieldDelta
                      return (
                      <div key={item.id} className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {item.menuItem.imageUrl ? (
                            <img
                              src={item.menuItem.imageUrl}
                              alt={item.name}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-xs font-bold text-orange-500 flex-shrink-0">
                              🍰
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                            {fieldTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {fieldTags.map((f, i) => (
                                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                                    {f.name}: {f.value}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-400">{item.quantity} × {formatPrice(unitPrice)}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                          {formatPrice(unitPrice * item.quantity)}
                        </span>
                      </div>
                      )
                    })}
                    <div className="border-t border-gray-100 pt-3 mt-1 flex justify-between">
                      <span className="text-sm font-bold text-gray-900">Total</span>
                      <span className="text-base font-extrabold text-gray-900">{formatPrice(order.totalAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {order.status === 'PENDING' && (
              <div className="space-y-3">
                <form action={acceptWithId} className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Delivery date/time
                      {!order.deliveryNote && <span className="text-amber-500 ml-1">(customer didn't specify — set one below)</span>}
                    </label>
                    <input
                      name="deliveryNote"
                      defaultValue={order.deliveryNote ?? ''}
                      placeholder="e.g. Tomorrow 3pm, Fri evening, ASAP"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400"
                    />
                  </div>
                  <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 text-sm font-bold transition-colors shadow-sm">
                    ✓ Accept Order
                  </button>
                </form>
                <form action={rejectWithId}>
                  <button type="submit" className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 rounded-xl py-3 text-sm font-bold transition-colors">
                    ✕ Reject Order
                  </button>
                </form>
              </div>
            )}

            {order.status === 'ACCEPTED' && !isCustom && order.totalAmount > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <form action={completeWithId}>
                  <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold transition-colors shadow-sm">
                    ✓ Mark Completed
                  </button>
                </form>
                <SendPaymentButton action={sendPaymentWithId} />
              </div>
            )}

            {order.status === 'ACCEPTED' && (isCustom || order.totalAmount === 0) && (
              <form action={completeWithId}>
                <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold transition-colors shadow-sm">
                  ✓ Mark as Completed
                </button>
              </form>
            )}

            {order.status === 'PAID' && (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-sm font-semibold text-center text-emerald-700">
                  💳 Payment received
                </div>
                <form action={completeWithId}>
                  <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold transition-colors shadow-sm">
                    ✓ Mark as Completed
                  </button>
                </form>
              </div>
            )}

            {(order.status === 'REJECTED' || order.status === 'COMPLETED') && (
              <div className={`rounded-xl px-5 py-3 text-sm font-medium text-center ${
                order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {order.status === 'COMPLETED' ? '✓ Order completed' : '✕ Order was rejected'}
              </div>
            )}
          </div>

          {/* ── Right column ────────────────────────────── */}
          <div className="space-y-4">

            {/* Customer card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Customer</h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 flex-shrink-0">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{order.customerName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{order.customerPhone}</p>
                </div>
              </div>
              <a
                href={`https://wa.me/${order.customerPhone.replace('+', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full border border-gray-200 hover:border-green-300 hover:bg-green-50 text-gray-600 hover:text-green-700 rounded-lg py-2 text-xs font-semibold transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Message on WhatsApp
              </a>
            </div>

            {/* Order metadata */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Order Info</h2>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Order ID</span>
                  <span className="font-mono font-semibold text-gray-700">#{shortId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Placed</span>
                  <span className="text-gray-700">{formatDateTime(order.createdAt)}</span>
                </div>
                {order.bakerNotifiedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Accepted</span>
                    <span className="text-gray-700">{formatDateTime(order.bakerNotifiedAt)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Status</span>
                  <span className={`font-semibold ${status.text}`}>{status.label}</span>
                </div>
                {!isCustom && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount</span>
                    <span className="font-bold text-gray-900">{formatPrice(order.totalAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Payment</span>
                  {order.paymentMethod === 'COD' ? (
                    <span className="font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[11px]">💵 Cash on Delivery</span>
                  ) : (
                    <span className="font-semibold text-blue-600">Online</span>
                  )}
                </div>
                {order.discountCode && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Discount ({order.discountCode})</span>
                    <span className="text-emerald-600 font-semibold">-{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                {order.deliveryNote && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 flex-shrink-0">Delivery</span>
                    <span className="text-gray-700 text-right">{order.deliveryNote}</span>
                  </div>
                )}
                {order.paymentLinkId && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400">Pay link</span>
                    <a
                      href={`${APP_URL}/pay/${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 font-medium"
                    >
                      Open →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
