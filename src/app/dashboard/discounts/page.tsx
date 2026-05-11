import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DiscountManager from './DiscountManager'

export default async function DiscountsPage() {
  const auth = await getAuthFromCookies()
  if (!auth) redirect('/login')

  const codes = await db.discountCode.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900">Discount Codes</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {codes.length}
        </span>
      </div>
      <div className="p-8">
        <DiscountManager codes={codes} />
      </div>
    </div>
  )
}
