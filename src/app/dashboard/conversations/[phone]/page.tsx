import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: Date) {
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  if (isToday) return 'Today'
  if (isYesterday) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Convert WhatsApp markdown to JSX-safe HTML segments
function parseWAMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: *text*
    const boldMatch = remaining.match(/^\*([^*\n]+)\*/)
    if (boldMatch) {
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }
    // Italic: _text_
    const italicMatch = remaining.match(/^_([^_\n]+)_/)
    if (italicMatch) {
      parts.push(<em key={key++} className="italic">{italicMatch[1]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }
    // Newline
    if (remaining[0] === '\n') {
      parts.push(<br key={key++} />)
      remaining = remaining.slice(1)
      continue
    }
    // Regular text — consume until next special char
    const plain = remaining.match(/^[^*_\n]+/)
    if (plain) {
      parts.push(<span key={key++}>{plain[0]}</span>)
      remaining = remaining.slice(plain[0].length)
    } else {
      // Fallback: consume one char to avoid infinite loop
      parts.push(<span key={key++}>{remaining[0]}</span>)
      remaining = remaining.slice(1)
    }
  }
  return parts
}

import React from 'react'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ phone: string }>
}) {
  const { phone } = await params
  const customerPhone = decodeURIComponent(phone)

  const [messages, lastOrder] = await Promise.all([
    db.message.findMany({
      where: { customerPhone },
      orderBy: { createdAt: 'asc' },
    }),
    db.order.findFirst({
      where: { customerPhone },
      orderBy: { createdAt: 'desc' },
      select: { id: true, customerName: true },
    }),
  ])

  if (messages.length === 0) notFound()

  const customerName = lastOrder?.customerName ?? customerPhone
  const initials = customerName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Group messages by date for date separators
  type DateGroup = { dateLabel: string; messages: typeof messages }
  const groups: DateGroup[] = []
  for (const msg of messages) {
    const label = formatDate(msg.createdAt)
    const last = groups[groups.length - 1]
    if (!last || last.dateLabel !== label) {
      groups.push({ dateLabel: label, messages: [msg] })
    } else {
      last.messages.push(msg)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/dashboard/conversations"
          className="text-gray-400 hover:text-gray-700 transition-colors text-sm font-medium"
        >
          ←
        </Link>
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600 flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{customerName}</p>
          <p className="text-xs text-gray-400">{customerPhone}</p>
        </div>
        {lastOrder && (
          <Link
            href={`/dashboard?phone=${encodeURIComponent(customerPhone)}`}
            className="text-xs text-orange-500 hover:text-orange-700 font-semibold border border-orange-200 hover:border-orange-400 px-2.5 py-1 rounded-lg transition-colors"
          >
            View orders
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1 bg-gray-50">
        {groups.map((group) => (
          <div key={group.dateLabel}>
            {/* Date separator */}
            <div className="flex items-center justify-center my-4">
              <span className="text-[11px] text-gray-400 bg-white border border-gray-100 rounded-full px-3 py-0.5 shadow-sm">
                {group.dateLabel}
              </span>
            </div>

            <div className="space-y-1">
              {group.messages.map((msg, idx) => {
                const isIn = msg.direction === 'IN'
                const prevSameDir = idx > 0 && group.messages[idx - 1].direction === msg.direction
                const nextSameDir = idx < group.messages.length - 1 && group.messages[idx + 1].direction === msg.direction

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isIn ? 'justify-start' : 'justify-end'} ${prevSameDir ? 'mt-0.5' : 'mt-2'}`}
                  >
                    <div
                      className={`
                        relative max-w-[75%] px-3.5 py-2 text-sm leading-relaxed shadow-sm
                        ${isIn
                          ? `bg-white text-gray-800 border border-gray-100
                             ${!prevSameDir ? 'rounded-t-2xl' : 'rounded-t-lg'}
                             ${!nextSameDir ? 'rounded-b-2xl rounded-tl-sm' : 'rounded-b-lg'}`
                          : `bg-[#E8F5E9] text-gray-800 border border-green-100
                             ${!prevSameDir ? 'rounded-t-2xl' : 'rounded-t-lg'}
                             ${!nextSameDir ? 'rounded-b-2xl rounded-tr-sm' : 'rounded-b-lg'}`
                        }
                      `}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {parseWAMarkdown(msg.body)}
                      </div>
                      <div
                        className={`text-[10px] mt-1 text-right ${
                          isIn ? 'text-gray-300' : 'text-green-400'
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                        {!isIn && (
                          <span className="ml-1 text-green-400">✓✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
