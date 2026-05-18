'use client'

import { useState } from 'react'

type BookingItem = { name: string; quantity: number; price: number }
type Booking = {
  id: string
  shortId: string
  customerName: string
  customerAge: number | null
  customerPhone: string
  preferredDate: string
  preferredTime: string
  confirmedDate: string | null
  confirmedTime: string | null
  status: string
  order: { totalAmount: number; items: BookingItem[] }
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
  COMPLETED: 'bg-blue-100 text-blue-800',
}

export default function BookingPanel({ booking, onClose, onUpdated }: {
  booking: Booking
  onClose: () => void
  onUpdated: () => void
}) {
  const [date, setDate] = useState(booking.confirmedDate ?? booking.preferredDate)
  const [time, setTime] = useState(booking.confirmedTime ?? booking.preferredTime)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function patch(payload: object) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed')
      onUpdated()
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const totalRs = (booking.order.totalAmount / 100).toFixed(0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-400 font-mono">{booking.shortId}</div>
            <h2 className="text-lg font-bold text-gray-900">{booking.customerName}{booking.customerAge ? `, ${booking.customerAge}` : ''}</h2>
            <div className="text-sm text-gray-500">{booking.customerPhone}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <span className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${STATUS_STYLE[booking.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {booking.status}
        </span>

        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
          <div><span className="text-gray-500">Preferred:</span> {booking.preferredDate}, {booking.preferredTime}</div>
          {booking.confirmedDate && (
            <div className="text-emerald-700 font-medium"><span className="text-gray-500">Confirmed:</span> {booking.confirmedDate}, {booking.confirmedTime}</div>
          )}
          <div className="pt-1 border-t border-gray-200 mt-2">
            {booking.order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-gray-700">
                <span>{item.name} × {item.quantity}</span>
                <span>₹{(item.price / 100).toFixed(0)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-gray-900 pt-1">
              <span>Total</span><span>₹{totalRs}</span>
            </div>
          </div>
        </div>

        {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Confirm / Reschedule</h3>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Date (e.g. 22 May)"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Time (e.g. 3pm)"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                disabled={loading}
                onClick={() => patch({ status: 'CONFIRMED', confirmedDate: date, confirmedTime: time })}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50"
              >
                Confirm + Notify
              </button>
              <button
                disabled={loading}
                onClick={() => patch({ confirmedDate: date, confirmedTime: time })}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50"
              >
                Reschedule + Notify
              </button>
            </div>
            <button
              disabled={loading}
              onClick={() => patch({ status: 'CANCELLED' })}
              className="w-full border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50"
            >
              Cancel Booking
            </button>
          </div>
        )}

        {booking.status === 'CONFIRMED' && (
          <button
            disabled={loading}
            onClick={() => patch({ status: 'COMPLETED' })}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50"
          >
            Mark Completed
          </button>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    </div>
  )
}
