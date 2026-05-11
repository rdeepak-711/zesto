import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import BotGraph from './BotGraph'

export default async function BotPage() {
  const auth = await getAuthFromCookies()
  if (!auth) redirect('/login')

  const [messages, rules] = await Promise.all([
    db.botMessage.findMany({ where: { tenantId: auth.tenantId }, orderBy: { key: 'asc' } }),
    db.botRule.findMany({ where: { tenantId: auth.tenantId }, orderBy: { sortOrder: 'asc' } }),
  ])

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Bot Script</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {messages.length} messages · {rules.length} rules
        </span>
      </div>
      <div className="p-8">
        <BotGraph initialMessages={messages} initialRules={rules} />
      </div>
    </div>
  )
}
