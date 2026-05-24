import { db } from '@/lib/db'
import { getAuthFromCookies } from '@/lib/auth'
import { redirect } from 'next/navigation'
import BotGraph from './BotGraph'
import BotEnquiryEditor from './BotEnquiryEditor'
import BotPhonePreview from './BotPhonePreview'
import BotOrderPreview from './BotOrderPreview'

export default async function BotPage() {
  const auth = await getAuthFromCookies()
  if (!auth) redirect('/login')

  const [messages, rules, menuItems] = await Promise.all([
    db.botMessage.findMany({ where: { tenantId: auth.tenantId }, orderBy: { key: 'asc' } }),
    db.botRule.findMany({ where: { tenantId: auth.tenantId }, orderBy: { sortOrder: 'asc' } }),
    db.menuItem.findMany({
      where: { tenantId: auth.tenantId },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId } })
  const businessName = tenant?.businessName ?? 'Your Business'
  const hasBooking = tenant?.hasBooking ?? false

  const msgMap = Object.fromEntries(messages.map(m => [m.key, m.value]))
  const isEnquiryMode = Boolean(msgMap['enquiry_mode'])

  // Build pricing sample (first 6 non-custom items)
  const pricingItems = menuItems
    .filter(i => !i.category.isCustom)
    .slice(0, 6)
  const pricingSample = pricingItems.length > 0
    ? pricingItems.map(i => `• ${i.name} — ₹${i.price}`).join('\n') +
      (menuItems.filter(i => !i.category.isCustom).length > 6 ? '\n…and more' : '')
    : '• (no items yet)'

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center gap-3 flex-shrink-0">
        <h1 className="text-base font-bold text-gray-900">Bot Script</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {messages.length} messages · {rules.length} rules
        </span>
        {isEnquiryMode && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            Enquiry Mode
          </span>
        )}
      </div>

      {/* Split layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: editor */}
        <div className="flex-1 overflow-y-auto p-8">
          {isEnquiryMode ? (
            <BotEnquiryEditor initialMessages={messages} />
          ) : (
            <BotGraph initialMessages={messages} initialRules={rules} />
          )}
        </div>

        {/* Right: phone preview (sticky) */}
        <div className="w-[340px] flex-shrink-0 border-l border-gray-200 bg-gray-50 overflow-y-auto p-6">
          {isEnquiryMode ? (
            <BotPhonePreview
              messages={msgMap}
              businessName={businessName}
              pricingSample={pricingSample}
            />
          ) : (
            <BotOrderPreview
              businessName={businessName}
              hasBooking={hasBooking}
              welcomeMsg={msgMap['welcome'] ?? ''}
            />
          )}
        </div>
      </div>
    </div>
  )
}
