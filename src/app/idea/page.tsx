import Link from 'next/link'

const problems = [
  {
    icon: '📱',
    title: 'Customers already use WhatsApp',
    desc: 'In India, WhatsApp is the default communication app. Customers already message businesses there — but most businesses reply manually, one chat at a time.',
  },
  {
    icon: '⏰',
    title: 'Orders come in at all hours',
    desc: 'A bakery gets "hi, what do you have?" at 11pm. A salon gets appointment requests on Sunday. Without automation, these are missed or handled slowly.',
  },
  {
    icon: '🗂️',
    title: 'No single source of truth',
    desc: 'Orders tracked in a notebook, WhatsApp screenshots, or a shared spreadsheet. No history, no analytics, no way to send payment links at scale.',
  },
]

const solution = [
  {
    step: '01',
    title: 'Conversational ordering',
    desc: 'Customers type "hi" — the bot shows menus, takes orders, collects a delivery date, validates discount codes, and confirms. All inside WhatsApp, no app download.',
  },
  {
    step: '02',
    title: 'Appointment booking',
    desc: 'Salons and service businesses get a booking FSM — name, age, date, time slot — with a calendar dashboard for the owner. Reschedule or cancel with one click.',
  },
  {
    step: '03',
    title: 'Enquiry capture',
    desc: 'Photo studios and custom shops use AI-assisted enquiry mode — the bot captures what the customer needs, routes to the right product flow, and notifies the owner.',
  },
  {
    step: '04',
    title: 'Owner dashboard',
    desc: 'Every order, booking, conversation, customer, and revenue metric — in one web panel. Manage from desktop or phone. No extra app.',
  },
]

const niches = [
  {
    icon: '🎂',
    name: 'Bakeries',
    desc: 'Cart ordering with cake customisation fields (flavour, size, message on cake). Delivery date collection. Razorpay advance payment.',
  },
  {
    icon: '💅',
    name: 'Salons & Makeup Studios',
    desc: 'Booking flow with service selection, preferred slot, name and age capture. Calendar dashboard. Reschedule / cancel notifications.',
  },
  {
    icon: '📸',
    name: 'Photo Studios',
    desc: 'Enquiry mode with product keyword routing — photo frames, acrylics, passport photos. AI reformats bespoke enquiries for the owner.',
  },
  {
    icon: '🍕',
    name: 'Restaurants & Cafés',
    desc: 'Full menu ordering with category fields (spice level, extras). Order tracking. Owner management via WhatsApp commands.',
  },
  {
    icon: '💊',
    name: 'Pharmacies & Grocery',
    desc: 'Cart ordering with availability toggle. Delivery date. Broadcast for restocks and promotions.',
  },
  {
    icon: '👗',
    name: 'Fashion & Retail',
    desc: 'Category fields for size, colour, and variant. Custom order flow for bespoke pieces. Customer CRM with lifetime spend.',
  },
]

const why = [
  {
    heading: 'Capability flags, not hardcoded business types',
    body: 'The bot branches on `hasCart`, `hasBooking`, `hasEnquiry`, `hasDelivery` flags — not a string like "bakery". Adding a new business type requires zero code changes.',
  },
  {
    heading: 'Multi-tenant from day one',
    body: 'One deployment serves many businesses. Every tenant has isolated data, their own WhatsApp number, and their own owner login. No cross-contamination.',
  },
  {
    heading: 'AI built in, not bolted on',
    body: 'Any customer question in any state (mid-order, mid-booking) triggers an AI info-bot — Gemini via OpenRouter — with full menu knowledge and conversation context.',
  },
  {
    heading: 'Owner-first design',
    body: 'Owners can manage entirely from WhatsApp commands (accept/reject/pay/complete) or from the dashboard. Both paths are first-class.',
  },
]

export default function IdeaPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 bg-white/95 backdrop-blur border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg no-underline text-gray-900">
          <span className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">Z</span>
          Zesto
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/idea" className="text-sm font-bold text-gray-900">The Idea</Link>
          <Link href="/product" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Dashboard</Link>
          <a href="/#features" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Features</a>
          <a href="/#contact" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Get Started</a>
        </div>
        <Link href="/login" className="px-5 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-orange-500 hover:text-orange-500 transition-colors">
          Login
        </Link>
      </nav>

      {/* HERO */}
      <section className="px-6 md:px-12 py-20 max-w-4xl mx-auto">
        <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-4">The Idea</div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-6">
          WhatsApp is already where your customers are.
          <br />
          <span className="text-orange-500">Your business should be there too.</span>
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed max-w-2xl">
          Small businesses in India handle orders on WhatsApp every day — manually. Zesto automates the whole flow,
          from first message to order confirmation, across every business type.
        </p>
      </section>

      {/* PROBLEM */}
      <section className="border-t border-gray-100 px-6 md:px-12 py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">The Problem</div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-14">Manual WhatsApp is breaking small businesses</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {problems.map(p => (
              <div key={p.title} className="bg-white border border-gray-200 rounded-2xl p-8">
                <div className="text-4xl mb-5">{p.icon}</div>
                <h3 className="font-bold text-base mb-3">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="border-t border-gray-100 px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">The Solution</div>
        <h2 className="text-3xl font-extrabold tracking-tight mb-14">Automate the entire customer journey</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {solution.map(s => (
            <div key={s.step} className="flex gap-6">
              <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                {s.step}
              </div>
              <div>
                <h3 className="font-bold text-base mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* NICHES */}
      <section className="border-t border-gray-100 bg-gray-50 px-6 md:px-12 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Built For</div>
          <h2 className="text-3xl font-extrabold tracking-tight mb-14">One platform, every business niche</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {niches.map(n => (
              <div key={n.name} className="bg-white border border-gray-200 rounded-2xl p-7 hover:border-orange-200 hover:bg-orange-50/20 transition-colors">
                <div className="text-3xl mb-4">{n.icon}</div>
                <h3 className="font-bold text-sm mb-2">{n.name}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{n.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY IT'S DIFFERENT */}
      <section className="border-t border-gray-100 px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Architecture</div>
        <h2 className="text-3xl font-extrabold tracking-tight mb-14">Why it&apos;s built to scale</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {why.map(w => (
            <div key={w.heading} className="border border-gray-200 rounded-2xl p-8">
              <h3 className="font-bold text-sm mb-3 text-gray-900">{w.heading}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-orange-500 px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">
            Ready to automate your WhatsApp?
          </h2>
          <p className="text-orange-100 mb-8 text-base">
            See the dashboard in action or get your business set up today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/product" className="px-8 py-3.5 bg-white text-orange-500 font-bold rounded-xl text-sm hover:bg-orange-50 transition-colors">
              See the Dashboard →
            </Link>
            <a href="/#contact" className="px-8 py-3.5 border border-orange-300 text-white font-semibold rounded-xl text-sm hover:border-white transition-colors">
              Get Started
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
