import { db } from '@/lib/db'
import MenuManager from './MenuManager'

export default async function MenuPage() {
  const categories = await db.menuCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0)

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Menu</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {totalItems} items
        </span>
      </div>
      <div className="p-8">
        <MenuManager categories={categories} />
      </div>
    </div>
  )
}
