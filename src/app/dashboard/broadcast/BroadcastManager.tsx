'use client'

import { useState, useEffect } from 'react'
import type { BroadcastSegment } from '@/app/api/broadcast/route'

type Broadcast = {
  id: number
  message: string
  sentCount: number
  failedCount: number
  createdAt: Date
}

const SEGMENTS: { value: BroadcastSegment; label: string; description: string }[] = [
  { value: 'all',        label: 'Everyone',      description: 'All customers who have placed an order' },
  { value: 'new',        label: 'First-timers',  description: 'Customers with exactly 1 order' },
  { value: 'repeat',     label: 'Repeat buyers', description: 'Customers with 2+ orders' },
  { value: 'high_value', label: 'High value',    description: 'Top 20% by total spend' },
  { value: 'inactive',   label: 'Inactive',      description: 'No order in the last 60 days' },
]

export default function BroadcastManager({ broadcasts: initial }: { broadcasts: Broadcast[] }) {
  const [broadcasts, setBroadcasts] = useState(initial)
  const [message, setMessage] = useState('')
  const [segment, setSegment] = useState<BroadcastSegment>('all')
  const [segmentCount, setSegmentCount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSegmentCount(null)
    fetch(`/api/broadcast?segment=${segment}`)
      .then(r => r.json())
      .then(d => setSegmentCount(d.count))
      .catch(() => setSegmentCount(null))
  }, [segment])

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), segment }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to send')
      }
      const b = await res.json()
      setBroadcasts([b, ...broadcasts])
      setMessage('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  function formatDate(d: Date | string) {
    return new Date(d).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const selectedSegment = SEGMENTS.find(s => s.value === segment)!

  return (
    <div className="max-w-2xl space-y-6">
      {/* Compose */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">New Broadcast</h2>
          <p className="text-xs text-gray-400">Send a WhatsApp message to a segment of your customers.</p>
        </div>

        {/* Segment selector */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">Audience</label>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map(s => (
              <button
                key={s.value}
                onClick={() => setSegment(s.value)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  segment === s.value
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {selectedSegment.description}
            {segmentCount !== null && (
              <span className="ml-1 font-semibold text-gray-700">— {segmentCount} customers</span>
            )}
          </p>
        </div>

        {/* Message */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message... (WhatsApp markdown: *bold*, _italic_)"
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 resize-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{message.length} chars</span>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim() || segmentCount === 0}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {sending
              ? 'Sending…'
              : segmentCount !== null
                ? `Send to ${segmentCount} customers`
                : 'Send'}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      {/* History */}
      {broadcasts.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Sent Broadcasts</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {broadcasts.map((b) => (
              <div key={b.id} className="px-5 py-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed mb-2">{b.message}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{formatDate(b.createdAt)}</span>
                  <span className="text-emerald-600 font-semibold">✓ {b.sentCount} sent</span>
                  {b.failedCount > 0 && (
                    <span className="text-red-500 font-semibold">✕ {b.failedCount} failed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-400 py-8">No broadcasts yet.</p>
      )}
    </div>
  )
}
