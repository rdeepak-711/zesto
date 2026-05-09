import { db } from '@/lib/db'
import MenuManager from './MenuManager'

export default async function MenuPage() {
  const categories = await db.menuCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Menu</h1>
      <MenuManager categories={categories} />
    </div>
  )
}
