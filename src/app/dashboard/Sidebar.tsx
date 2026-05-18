'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar({ pendingCount = 0, businessName = 'Dashboard', hasBooking = false }: { pendingCount?: number; businessName?: string; hasBooking?: boolean }) {
  const pathname = usePathname()

  const NAV = [
    {
      section: 'Main',
      items: [
        { href: '/dashboard', label: 'Orders', icon: '🛍️', exact: true },
        ...(hasBooking ? [{ href: '/dashboard/bookings', label: 'Bookings', icon: '📅', exact: false }] : []),
        { href: '/dashboard/conversations', label: 'Conversations', icon: '💬' },
        { href: '/dashboard/customers', label: 'Customers', icon: '👥' },
        { href: '/dashboard/broadcast', label: 'Broadcast', icon: '📣' },
      ],
    },
    {
      section: 'Business',
      items: [
        { href: '/dashboard/menu', label: 'Menu', icon: '🍰' },
        { href: '/dashboard/bot', label: 'Bot Script', icon: '🤖' },
        { href: '/dashboard/discounts', label: 'Discounts', icon: '🏷️' },
        { href: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
        { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
      ],
    },
  ]

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <aside className="w-[220px] flex-shrink-0 bg-slate-900 flex flex-col fixed top-0 left-0 bottom-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500 rounded-[9px] flex items-center justify-center text-base flex-shrink-0">
            🛍️
          </div>
          <div className="min-w-0">
            <div className="text-[17px] font-bold text-white leading-none truncate">{businessName}</div>
            <div className="text-[11px] text-white/40 mt-0.5">Owner Dashboard</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {NAV.map((group) => (
          <div key={group.section} className="mb-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/25 px-2 mb-1">
              {group.section}
            </div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                  isActive(item.href, item.exact)
                    ? 'bg-orange-500/15 text-orange-400'
                    : 'text-white/55 hover:bg-white/[0.06] hover:text-white/85'
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.href === '/dashboard' && item.exact && pendingCount > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[12px] font-bold text-orange-400 flex-shrink-0">
            B
          </div>
          <span className="text-[13px] text-white/70">Owner</span>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full text-left text-[12px] text-white/30 hover:text-white/60 px-2.5 py-1.5 mt-1 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
