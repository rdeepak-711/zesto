import { db } from '@/lib/db'
import BroadcastManager from './BroadcastManager'

export default async function BroadcastPage() {
  const broadcasts = await db.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Broadcast</h1>
      </div>
      <div className="p-8">
        <BroadcastManager broadcasts={broadcasts} />
      </div>
    </div>
  )
}
