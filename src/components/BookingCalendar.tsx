'use client'

import { useState } from 'react'
import BookingPanel from './BookingPanel'

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

const STATUS_DOT: Record<string, string> = {
  PENDING: 'bg-amber-400',
  CONFIRMED: 'bg-emerald-500',
  CANCELLED: 'bg-gray-300',
  COMPLETED: 'bg-blue-400',
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function bookingMatchesDay(booking: Booking, year: number, month: number, day: number): boolean {
  const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const src = (booking.confirmedDate || booking.preferredDate) ?? ''
  if (src.includes(isoDate)) return true
  // Word-boundary match: \b2\b won't match "22", preventing false positives
  const wordPattern = new RegExp(`\\b${day}\\b.*\\b${MONTH_NAMES[month]}\\b`, 'i')
  return wordPattern.test(src)
}

export default function BookingCalendar({ initialBookings }: { initialBookings: Booking[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [selected, setSelected] = useState<Booking | null>(null)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  async function refresh() {
    try {
      const res = await fetch('/api/bookings')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.bookings)) {
        setBookings(data.bookings)
      }
    } catch {
      // silent fail — stale bookings remain visible, user can reload
    }
    setSelected(null)
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 text-xl px-2">‹</button>
        <h2 className="text-base font-semibold text-gray-800 min-w-[120px] text-center">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700 text-xl px-2">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden">
        {cells.map((day, i) => {
          const dayBookings = day ? bookings.filter(b => bookingMatchesDay(b, year, month, day)) : []
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          return (
            <div
              key={i}
              className={`bg-white min-h-[80px] p-1.5 ${day ? 'hover:bg-slate-50 cursor-default' : ''}`}
            >
              {day && (
                <>
                  <div className={`text-[12px] font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-orange-500 text-white' : 'text-gray-700'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayBookings.map(b => (
                      <button
                        key={b.id}
                        onClick={() => setSelected(b)}
                        className="w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-50 hover:bg-orange-50 border border-gray-100 truncate"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[b.status] ?? 'bg-gray-300'}`} />
                        <span className="truncate text-gray-700">{b.customerName}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-4 mt-3 text-[11px] text-gray-500">
        {Object.entries(STATUS_DOT).map(([status, cls]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cls}`} />
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </span>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">All Bookings</h3>
        <div className="space-y-2">
          {bookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED').map(b => (
            <button
              key={b.id}
              onClick={() => setSelected(b)}
              className="w-full text-left flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:bg-slate-50"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[b.status] ?? 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{b.customerName} <span className="text-gray-400 font-normal text-xs">[{b.shortId}]</span></div>
                <div className="text-xs text-gray-500 truncate">{b.preferredDate}, {b.preferredTime}</div>
              </div>
              <div className="text-xs text-gray-400">₹{(b.order.totalAmount / 100).toFixed(0)}</div>
            </button>
          ))}
          {bookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED').length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No active bookings</p>
          )}
        </div>
      </div>

      {selected && (
        <BookingPanel
          booking={selected}
          onClose={() => setSelected(null)}
          onUpdated={refresh}
        />
      )}
    </div>
  )
}
