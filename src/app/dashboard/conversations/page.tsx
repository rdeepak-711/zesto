import { db } from '@/lib/db'
import Link from 'next/link'

export default async function ConversationsPage() {
  // Get unique phones with their latest message
  const messages = await db.message.findMany({
    orderBy: { createdAt: 'desc' },
    distinct: ['customerPhone'],
    take: 50,
  })

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Conversations</h1>

      {messages.length === 0 ? (
        <div className="text-center text-gray-400 py-16">No conversations yet.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {messages.map((msg) => (
            <Link
              key={msg.customerPhone}
              href={`/dashboard/conversations/${encodeURIComponent(msg.customerPhone)}`}
              className="flex items-start justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{msg.customerPhone}</p>
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  {msg.direction === 'IN' ? '' : '↩ '}
                  {msg.body}
                </p>
              </div>
              <span className="text-xs text-gray-400 ml-3 shrink-0 mt-0.5">
                {msg.createdAt.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
