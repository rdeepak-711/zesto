import { db } from '@/lib/db'
import Link from 'next/link'

export default async function ConversationsPage() {
  const messages = await db.message.findMany({
    orderBy: { createdAt: 'desc' },
    distinct: ['customerPhone'],
    take: 50,
  })

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Conversations</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {messages.length} active
        </span>
      </div>

      <div className="p-8">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-16 text-sm">No conversations yet.</div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <Link
                key={msg.customerPhone}
                href={`/dashboard/conversations/${encodeURIComponent(msg.customerPhone)}`}
                className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 flex items-center gap-3.5 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
                  👤
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{msg.customerPhone}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
                    {msg.direction === 'IN' ? '' : '↩ '}
                    {msg.body}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-gray-400">
                    {msg.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  {msg.direction === 'IN' && (
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
