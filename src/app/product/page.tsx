import Link from 'next/link'
import Image from 'next/image'

const sections = [
  {
    id: 'orders',
    label: 'Orders',
    title: 'Every order, one dashboard',
    desc: 'All incoming orders land here in real time — with customer phone, items, amount, and status. Accept or reject with one click. Filter by Pending, Accepted, Paid, Completed, or Rejected. Clicking an order opens a detail panel with full item breakdown, delivery date, discount applied, and action buttons.',
    bullets: [
      'Real-time order list with status badges',
      'One-click Accept / Reject / Request Payment / Complete',
      'Order detail panel with itemised breakdown',
      'Status filter tabs + order search',
    ],
    image: '/screenshots/orders.avif',
    imageAlt: 'Orders dashboard showing order list with status filters',
    imageLeft: false,
  },
  {
    id: 'conversations',
    label: 'Conversations',
    title: 'Every customer conversation',
    desc: 'The full WhatsApp message history for every customer, per tenant. Conversations are threaded by phone number. Double ticks on outgoing messages. The inbox shows the last message per customer — new messages are highlighted with an orange dot. Click any thread to see the full chat.',
    bullets: [
      'Per-customer inbox with last message preview',
      'Full chat thread with timestamps and delivery ticks',
      'New message indicator',
      'Scoped per tenant — no cross-business data',
    ],
    image: '/screenshots/conversations.avif',
    imageAlt: 'Conversations page showing Phoenix Photo Studio chat thread',
    imageLeft: false,
  },
  {
    id: 'menu',
    label: 'Menu',
    title: 'Menu manager with category fields',
    desc: 'Build your menu in minutes. Add categories, items with names, prices, descriptions, and images. Mark items as unavailable in one tap (useful for seasonal items). Each category supports custom fields — multiple choice or short text questions asked at order time (e.g., cake flavour, size, message on top). Category fields are stored as JSON on each order item.',
    bullets: [
      'Category + item tree with drag-free ordering',
      'Item images, descriptions, and prices',
      'Available / Unavailable toggle per item',
      'Category fields builder for custom questions at order time',
    ],
    image: '/screenshots/menu.avif',
    imageAlt: 'Menu manager showing Sweet Crumbs Bakery with cake images',
    imageLeft: true,
  },
  {
    id: 'bot',
    label: 'Bot Script',
    title: 'Visual bot script editor',
    desc: 'See and edit every message the bot sends — welcome, cart empty, confirm hint, cancel, and more. The FSM flow diagram shows every state and transition. A live phone preview animates the full conversation on the right side.',
    bullets: [
      'FSM flow diagram with all states and transitions',
      'Edit every bot message inline',
      'Live animated phone preview',
    ],
    image: '/screenshots/bot-script.avif',
    imageAlt: 'Bot Script page showing FSM flow diagram and live phone preview',
    imageLeft: false,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    title: 'Revenue and order analytics',
    desc: 'A 30-day revenue chart (daily, paid + completed orders), top items by units sold, peak order hours, and quick stats at a glance. Repeat rate, average order value, total customers, and pending orders are always visible. All data is scoped to the tenant — no shared numbers.',
    bullets: [
      'Daily revenue chart — last 30 days',
      'Top items by units sold',
      'Peak order hours chart',
      'Quick stats: repeat rate, avg order value, pending count',
    ],
    image: '/screenshots/analytics.avif',
    imageAlt: 'Analytics page showing revenue chart and top items',
    imageLeft: true,
  },
]

const moreFeatures = [
  { icon: '📣', title: 'Broadcast', desc: 'Send a WhatsApp message to all past customers in one click — promotions, new items, holiday hours.' },
  { icon: '🎟️', title: 'Discount Codes', desc: 'Create percent or flat-off codes with expiry dates and usage limits. Validated by the bot at checkout.' },
  { icon: '👥', title: 'Customer CRM', desc: 'Every customer who\'s placed an order — phone, order count, lifetime spend, last order date.' },
  { icon: '⚙️', title: 'Settings', desc: 'Business name, type, address, logo, delivery date toggle, Razorpay credentials. All editable from the dashboard.' },
  { icon: '💳', title: 'Razorpay Payments', desc: 'Owner sends a payment link over WhatsApp. Customer pays in browser. Dashboard shows Paid status instantly.' },
  { icon: '🔐', title: 'OTP Login', desc: 'Owners authenticate via WhatsApp OTP — no passwords, no email. JWT in httpOnly cookie.' },
]

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 bg-white/95 backdrop-blur border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg no-underline text-gray-900">
          <span className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">Z</span>
          Zesto
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/idea" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">The Idea</Link>
          <Link href="/product" className="text-sm font-bold text-gray-900">Dashboard</Link>
          <a href="/#features" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Features</a>
          <a href="/#contact" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Get Started</a>
        </div>
        <Link href="/login" className="px-5 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-orange-500 hover:text-orange-500 transition-colors">
          Login
        </Link>
      </nav>

      {/* HERO */}
      <section className="px-6 md:px-12 py-20 max-w-4xl mx-auto text-center">
        <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-4">The Dashboard</div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-6">
          Everything you need to run your business
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-10">
          Orders, conversations, menu, analytics, and settings — all in one clean web dashboard.
          Built for bakeries and food businesses.
        </p>
        {/* Jump links */}
        <div className="flex flex-wrap justify-center gap-2">
          {sections.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-4 py-2 bg-gray-100 hover:bg-orange-50 hover:text-orange-600 text-gray-600 text-sm font-medium rounded-full transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </section>

      {/* SECTIONS */}
      {sections.map((s, idx) => (
        <section
          key={s.id}
          id={s.id}
          className={`border-t border-gray-100 px-6 md:px-12 py-20 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}
        >
          <div className="max-w-6xl mx-auto">
            <div className={`grid md:grid-cols-2 gap-12 items-center ${s.imageLeft ? 'md:grid-flow-dense' : ''}`}>

              {/* Text */}
              <div className={s.imageLeft ? 'md:col-start-2' : ''}>
                <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">{s.label}</div>
                <h2 className="text-3xl font-extrabold tracking-tight mb-4">{s.title}</h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-6">{s.desc}</p>
                <ul className="space-y-2.5">
                  {s.bullets.map(b => (
                    <li key={b} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-[10px] font-bold flex-shrink-0 mt-0.5">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Screenshot */}
              <div className={`rounded-2xl overflow-hidden shadow-xl border border-gray-200 ${s.imageLeft ? 'md:col-start-1 md:row-start-1' : ''}`}>
                <Image
                  src={s.image}
                  alt={s.imageAlt}
                  width={1440}
                  height={900}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* MORE FEATURES */}
      <section className="border-t border-gray-100 px-6 md:px-12 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">More Features</div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-14">Everything else included</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {moreFeatures.map(f => (
              <div key={f.title} className="bg-gray-50 border border-gray-200 rounded-2xl p-7 hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-orange-500 px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">
            Ready to see it live?
          </h2>
          <p className="text-orange-100 mb-8 text-base">
            All three demo businesses — bakery, salon, photo studio — are live and running right now.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="px-8 py-3.5 bg-white text-orange-500 font-bold rounded-xl text-sm hover:bg-orange-50 transition-colors">
              Open Dashboard →
            </Link>
            <a href="/#contact" className="px-8 py-3.5 border border-orange-300 text-white font-semibold rounded-xl text-sm hover:border-white transition-colors">
              Get My Business Set Up
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 px-8 md:px-12 py-7 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-bold text-sm text-gray-900">Zesto</span>
        <div className="flex items-center gap-6">
          <Link href="/idea" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">The Idea</Link>
          <Link href="/product" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Dashboard</Link>
          <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Login</Link>
        </div>
        <span className="text-xs text-gray-400">© 2026 Zesto. WhatsApp ordering for any business.</span>
      </footer>
    </div>
  )
}
