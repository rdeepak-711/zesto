import Link from 'next/link'
import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromCookies()
  if (!auth) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <span className="text-lg font-bold text-orange-500">Zesto</span>
          <p className="text-xs text-gray-400 mt-0.5">Baker Dashboard</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink href="/dashboard" exact>Orders</NavLink>
          <NavLink href="/dashboard/conversations">Conversations</NavLink>
          <NavLink href="/dashboard/menu">Menu</NavLink>
          <NavLink href="/dashboard/analytics">Analytics</NavLink>
          <NavLink href="/dashboard/settings">Settings</NavLink>
        </nav>
        <div className="p-3 border-t border-gray-100">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full text-left text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}

function NavLink({
  href,
  children,
  exact,
}: {
  href: string
  children: React.ReactNode
  exact?: boolean
}) {
  return (
    <Link
      href={href}
      className="block text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-colors"
    >
      {children}
    </Link>
  )
}
