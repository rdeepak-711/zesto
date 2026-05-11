import Link from 'next/link'
import ContactForm from './ContactForm'

const features = [
  {
    icon: '🤖',
    title: 'Conversational Bot',
    desc: 'Handles the full order flow — menu, cart, delivery date, confirmation — automatically. Works 24/7, never gets tired.',
  },
  {
    icon: '📋',
    title: 'Order Dashboard',
    desc: 'Every order in one place. Accept, reject, set delivery time, and track payment status from one clean web panel.',
  },
  {
    icon: '🎂',
    title: 'Menu Manager',
    desc: 'Add items with images, descriptions, and prices. Variants (size/flavour), hide seasonal items in one tap.',
  },
  {
    icon: '💳',
    title: 'Razorpay Payments',
    desc: 'Send a payment link over WhatsApp. Customer pays in-browser. You see it land in the dashboard instantly.',
  },
  {
    icon: '🎟️',
    title: 'Discount Codes',
    desc: 'Create percent or flat-off codes with expiry dates and usage limits. Bot validates them at checkout automatically.',
  },
  {
    icon: '📣',
    title: 'Broadcast Messages',
    desc: 'Send a promotion, new product, or holiday hours to all past customers in one click — straight from WhatsApp.',
  },
]

const steps = [
  {
    num: '1',
    title: 'Customer messages',
    desc: 'They send "hi" to your WhatsApp number. The bot greets them, shows your menu, and guides them to checkout.',
  },
  {
    num: '2',
    title: 'You get notified',
    desc: 'Order lands in your WhatsApp instantly. Reply ACCEPT or REJECT — straight from your phone, no app needed.',
  },
  {
    num: '3',
    title: 'Manage from dashboard',
    desc: 'Track all orders, request payment, update your menu, and see revenue — from one clean web dashboard.',
  },
]

const stats = [
  { num: '0 mins', label: 'Setup time' },
  { num: '₹0', label: 'Per-order fees' },
  { num: '24/7', label: 'Bot takes orders' },
  { num: '1 click', label: 'Baker notification' },
]

const trust = [
  'No technical setup needed',
  'No per-order fees, ever',
  'Works on any WhatsApp number',
  'Your data, your control',
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 md:px-12 h-16 bg-white/95 backdrop-blur border-b border-gray-100">
        <a href="#" className="flex items-center gap-2 font-bold text-lg no-underline text-gray-900">
          <span className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">Z</span>
          Zesto
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a href="#how" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">How it works</a>
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
              WhatsApp Ordering for Bakeries
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5">
              Take orders on{' '}
              <span className="text-orange-500">WhatsApp.</span>{' '}
              Run your bakery smarter.
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Zesto turns WhatsApp into your ordering counter. Customers chat, the bot handles it — you bake.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="#contact"
                className="px-7 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Get Started →
              </a>
              <a href="#how" className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">
                See how it works ↓
              </a>
            </div>
          </div>

          {/* Chat mockup */}
          <div className="bg-[#ece5dd] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3">
              <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center text-lg">🎂</div>
              <div>
                <div className="text-sm font-semibold text-white">Sweet Crumbs Bakery</div>
                <div className="text-[11px] text-white/70">online</div>
              </div>
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              <ChatBubble side="user">hi</ChatBubble>
              <ChatBubble side="bot">
                <span>👋 Welcome! What would you like to order?</span>
                <br /><br />
                <strong>1.</strong> Cakes<br />
                <strong>2.</strong> Pastries<br />
                <strong>3.</strong> Cookies
              </ChatBubble>
              <ChatBubble side="user">1</ChatBubble>
              <ChatBubble side="bot">
                <strong>Cakes</strong><br /><br />
                1. Chocolate Fudge Cake — ₹800<br />
                2. Vanilla Dream Cake — ₹700<br />
                3. Red Velvet Cake — ₹900
              </ChatBubble>
              <ChatBubble side="user">2</ChatBubble>
              <ChatBubble side="bot">
                ✅ Added to cart! <strong>Total: ₹700</strong><br /><br />
                Add more or type <strong>confirm</strong>
              </ChatBubble>
            </div>
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

      {/* FEATURES */}
      <section id="features" className="border-t border-gray-100 px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <div className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Features</div>
        <h2 className="text-3xl font-extrabold tracking-tight mb-14">Everything a bakery needs</h2>
        <div className="grid md:grid-cols-3 gap-5">
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
              Fill in your details and we&apos;ll set up Zesto for your bakery. Takes less than a day.
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
      <footer className="border-t border-gray-100 px-8 md:px-12 py-7 flex items-center justify-between">
        <span className="font-bold text-sm text-gray-900">Zesto</span>
        <span className="text-xs text-gray-400">© 2026 Zesto. WhatsApp ordering for bakeries.</span>
      </footer>
    </div>
  )
}

function ChatBubble({ side, children }: { side: 'bot' | 'user'; children: React.ReactNode }) {
  return (
    <div className={`flex ${side === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-3 py-2 text-xs leading-relaxed text-gray-700 shadow-sm ${
          side === 'bot'
            ? 'bg-white rounded-tr-xl rounded-b-xl'
            : 'bg-[#dcf8c6] rounded-tl-xl rounded-b-xl'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
