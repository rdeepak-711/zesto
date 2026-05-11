import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from './Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromCookies()
  if (!auth) redirect('/login')

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      <Sidebar />
      <main className="ml-[220px] flex-1 overflow-auto flex flex-col">{children}</main>
    </div>
  )
}
