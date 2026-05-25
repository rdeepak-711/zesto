import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import Sidebar from './Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromCookies()
  if (!auth) redirect('/login')

  const [pendingCount, tenant] = await Promise.all([
    db.order.count({ where: { tenantId: auth.tenantId, status: 'PENDING' } }),
    db.tenant.findUnique({ where: { id: auth.tenantId }, select: { businessName: true } }),
  ])

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      <Sidebar pendingCount={pendingCount} businessName={tenant?.businessName ?? 'Dashboard'} />
      <main className="ml-[220px] flex-1 overflow-auto flex flex-col">{children}</main>
    </div>
  )
}
