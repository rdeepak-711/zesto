import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import Sidebar from './Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromCookies()
  if (!auth) redirect('/login')

  const pendingCount = await db.order.count({ where: { status: 'PENDING' } })

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      <Sidebar pendingCount={pendingCount} />
      <main className="ml-[220px] flex-1 overflow-auto flex flex-col">{children}</main>
    </div>
  )
}
