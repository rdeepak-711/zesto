import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ phone: string }>
}) {
  const { phone } = await params
  const customerPhone = decodeURIComponent(phone)

  const messages = await db.message.findMany({
    where: { customerPhone },
    orderBy: { createdAt: 'asc' },
  })

  if (messages.length === 0) notFound()

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/conversations" className="text-sm text-gray-400 hover:text-gray-600">
          ← Conversations
        </Link>
        <span className="text-gray-200">|</span>
        <h1 className="text-sm font-semibold text-gray-900">{customerPhone}</h1>
      </div>

      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'IN' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${
                msg.direction === 'IN'
                  ? 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                  : 'bg-orange-500 text-white rounded-tr-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.body}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.direction === 'IN' ? 'text-gray-400' : 'text-orange-200'
                }`}
              >
                {msg.createdAt.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
