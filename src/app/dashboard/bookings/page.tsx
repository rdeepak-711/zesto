import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import BookingCalendar from '@/components/BookingCalendar'

export const dynamic = 'force-dynamic'

export default async function BookingsPage() {
  const auth = await getAuthFromCookies()
  if (!auth) redirect('/login')

  const bookings = await db.booking.findMany({
    where: { tenantId: auth.tenantId },
    include: { order: { include: { items: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const serialized = bookings.map(b => ({
    id: b.id,
    shortId: b.shortId,
    customerName: b.customerName,
    customerAge: b.customerAge,
    customerPhone: b.customerPhone,
    preferredDate: b.preferredDate,
    preferredTime: b.preferredTime,
    confirmedDate: b.confirmedDate,
    confirmedTime: b.confirmedTime,
    status: b.status,
    order: {
      totalAmount: b.order.totalAmount,
      items: b.order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
    },
  }))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage appointment requests. Click a booking to confirm or reschedule.</p>
      </div>
      <BookingCalendar initialBookings={serialized} />
    </div>
  )
}
