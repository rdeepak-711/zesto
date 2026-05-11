import { db } from '@/lib/db'
import BroadcastManager from './BroadcastManager'

export default async function BroadcastPage() {
  const [broadcasts, customerCount] = await Promise.all([
    db.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.order
      .groupBy({ by: ['customerPhone'] })
      .then((r) => r.length),
  ])

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Broadcast</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {customerCount} recipients
        </span>
      </div>
      <div className="p-8">
        <BroadcastManager broadcasts={broadcasts} customerCount={customerCount} />
      </div>
    </div>
  )
}
