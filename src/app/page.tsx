import Link from 'next/link'
import Image from 'next/image'
import ContactForm from './ContactForm'

const niches = [
  { icon: '🎂', label: 'Bakery' },
  { icon: '💅', label: 'Salon' },
  { icon: '📸', label: 'Photo Studio' },
  { icon: '🍕', label: 'Restaurant' },
  { icon: '☕', label: 'Café' },
  { icon: '💊', label: 'Pharmacy' },
  { icon: '👗', label: 'Fashion' },
  { icon: '🛒', label: 'Grocery' },
]

const stats = [
  { num: '0 mins', label: 'Setup time' },
  { num: '₹0', label: 'Per-order fees' },
  { num: '24/7', label: 'Bot takes orders' },
  { num: '3 niches', label: 'Live & tested' },
]

const steps = [
  {
    num: '1',
    title: 'Customer says "hi"',
    desc: 'They message your WhatsApp number. The bot greets them, shows your menu or services, and guides them through.',
  },
  {
    num: '2',
    title: 'Order placed',
    desc: 'Cart built inside WhatsApp. No app download, no account required.',
  },
  {
    num: '3',
    title: 'You manage from the dashboard',
    desc: 'Accept orders, send payment links, track revenue. One dashboard, all channels.',
  },
]

const features = [
  { icon: '🤖', title: 'Conversational Bot', desc: 'Full ordering flows handled automatically. Works 24/7.' },
  { icon: '📋', title: 'Order Dashboard', desc: 'Every order in one place. Accept, reject, track payment, set delivery time.' },
  { icon: '🍰', title: 'Menu Manager', desc: 'Add items with images, prices, and category fields. Hide seasonal items in one tap.' },
  { icon: '📊', title: 'Analytics', desc: 'Revenue charts, top items, peak hours, repeat rate — all from real order data.' },
  { icon: '📣', title: 'Broadcast', desc: 'Send promotions or updates to all past customers in one click via WhatsApp.' },
  { icon: '💳', title: 'Razorpay Payments', desc: 'Send payment links over WhatsApp. Customer pays in-browser, you see it instantly.' },
  { icon: '🎟️', title: 'Discount Codes', desc: 'Percent or flat-off codes with expiry and usage limits. Validated at checkout.' },
  { icon: '🤝', title: 'Multi-tenant SaaS', desc: 'One deployment, many businesses. Every tenant has isolated data and their own login.' },
]

const trust = [
  'No technical setup needed',
  'No per-order fees, ever',
  'Works on any WhatsApp number',
  'Bakery, salon, photo studio — one platform',
]

export default function HomePage() {
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
          <Link href="/product" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Dashboard</Link>
          <a href="#features" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Features</a>
          <a href="#contact" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Get Started</a>
        </div>
        <Link
          href="/login"
          className="px-5 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-orange-500 hover:text-orange-500 transition-colors"
        >
          Login
        </Link>
      </nav>

      {/* HERO */}
      <section className="px-6 md:px-12 py-20 md:py-28 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-500 text-xs font-semibold px-3 py-1 rounded-full mb-5">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
              WhatsApp Bot + Owner Dashboard
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
              Run your business on{' '}
              <span className="text-orange-500">WhatsApp.</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-6">
              Zesto turns WhatsApp into your ordering counter.
              Customers chat — your bot handles it. You manage everything from one dashboard.
            </p>
            {/* Niche pills */}
            <div className="flex flex-wrap gap-2 mb-8">
              {niches.map(n => (
                <span key={n.label} className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">
                  <span>{n.icon}</span> {n.label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <a href="#contact" className="px-7 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors">
                Get Started →
              </a>
              <Link href="/product" className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">
                See the dashboard ↓
              </Link>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
            <Image
              src="/screenshots/orders.avif"
              alt="Zesto owner dashboard showing orders"
              width={1440}
              height={900}
              className="w-full h-auto"
              priority
            />
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="bg-gray-50 border-y border-gray-100 py-8">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold text-orange-500">{s.num}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how" className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">How it works</div>
        <h2 className="text-3xl font-extrabold tracking-tight mb-3">Three steps, zero friction</h2>
        <p className="text-base text-gray-500 max-w-lg leading-relaxed">
          Your customers already have WhatsApp. No app downloads, no accounts, no friction.
        </p>
        <div className="grid md:grid-cols-3 gap-8 mt-14 relative">
          {steps.map((step, i) => (
            <div key={step.num} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-5 left-10 right-[-32px] h-px bg-gray-200 z-0" />
              )}
              <div className="relative z-10 w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center font-extrabold text-base mb-4">
                {step.num}
              </div>
              <h3 className="font-bold text-base mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DASHBOARD PREVIEW STRIP */}
      <section className="bg-gray-50 border-y border-gray-100 px-6 md:px-12 py-16 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Dashboard</div>
          <div className="flex items-end justify-between mb-8 gap-4">
            <h2 className="text-3xl font-extrabold tracking-tight">Everything in one place</h2>
            <Link href="/product" className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors flex-shrink-0">
              Full tour →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200 md:col-span-2">
              <Image src="/screenshots/bot-script.avif" alt="Bot Script editor" width={1440} height={900} className="w-full h-auto" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200 flex-1">
                <Image src="/screenshots/analytics.avif" alt="Analytics" width={1440} height={900} className="w-full h-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Features</div>
        <h2 className="text-3xl font-extrabold tracking-tight mb-14">Built for every business type</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-gray-50 border border-gray-200 rounded-2xl p-7 hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-sm mb-2">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-20 grid md:grid-cols-2 gap-20 items-start">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Get started</div>
            <h2 className="text-3xl font-extrabold tracking-tight mb-4">Ready to take orders on WhatsApp?</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              Fill in your details and we&apos;ll set up Zesto for your business. Takes less than a day.
            </p>
            <ul className="space-y-3.5">
              {trust.map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-[10px] font-bold flex-shrink-0">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <ContactForm />
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
