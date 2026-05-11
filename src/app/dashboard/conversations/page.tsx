import { db } from '@/lib/db'
import Link from 'next/link'

function stripMarkdown(text: string): string {
  return text.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1').replace(/\n+/g, ' ')
}

function formatDate(d: Date) {
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default async function ConversationsPage() {
  const recentMessages = await db.message.findMany({
    orderBy: { createdAt: 'desc' },
    distinct: ['customerPhone'],
    take: 50,
  })

  if (recentMessages.length === 0) {
    return (
      <div>
        <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center">
          <h1 className="text-base font-bold text-gray-900">Conversations</h1>
        </div>
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">
          No conversations yet.
        </div>
      </div>
    )
  }

  // Fetch customer names from orders
  const phones = recentMessages.map((m) => m.customerPhone)
  const lastOrders = await db.order.findMany({
    where: { customerPhone: { in: phones } },
    orderBy: { createdAt: 'desc' },
    distinct: ['customerPhone'],
    select: { customerPhone: true, customerName: true },
  })
  const nameMap = Object.fromEntries(lastOrders.map((o) => [o.customerPhone, o.customerName]))

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Conversations</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {recentMessages.length}
        </span>
      </div>

      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
          {recentMessages.map((msg) => {
            const name = nameMap[msg.customerPhone] ?? msg.customerPhone
            const initials = name
              .split(' ')
              .map((w: string) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()
            const preview = stripMarkdown(msg.body).slice(0, 80)
            const isUnread = msg.direction === 'IN'

            return (
              <Link
                key={msg.customerPhone}
                href={`/dashboard/conversations/${encodeURIComponent(msg.customerPhone)}`}
                className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 flex-shrink-0">
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {name}
                    </span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{formatDate(msg.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {msg.direction === 'OUT' && (
                      <span className="text-[10px] text-green-500 flex-shrink-0">✓✓</span>
                    )}
                    <span className={`text-xs truncate ${isUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      {preview}
                    </span>
                  </div>
                </div>

                {isUnread && (
                  <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
