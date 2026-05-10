import { db } from '@/lib/db'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })

  return (
    <div>
      <div className="bg-white border-b border-gray-200 px-8 h-14 flex items-center">
        <h1 className="text-base font-bold text-gray-900">Settings</h1>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-[200px_1fr] gap-6 max-w-4xl">
          {/* Settings nav */}
          <div className="space-y-0.5">
            <div className="px-3 py-2 rounded-lg text-sm font-semibold text-orange-500 bg-white border-l-[3px] border-orange-500">
              🏪 Bakery Info
            </div>
            <div className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-white hover:text-gray-900 cursor-default">
              🔗 Widget
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {config ? (
              <SettingsForm config={config} />
            ) : (
              <p className="text-sm text-gray-400">No configuration found.</p>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-sm font-bold text-gray-900 mb-1">Website Widget</h2>
              <p className="text-xs text-gray-400 mb-4">
                Add this snippet to your website to show the WhatsApp order button.
              </p>
              <pre className="bg-slate-900 rounded-xl p-4 text-xs text-sky-300 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                {`<script src="${process.env.NEXT_PUBLIC_APP_URL}/widget.js" data-zesto data-phone="${config?.whatsappNumber ?? '+91XXXXXXXXXX'}" data-label="Order via WhatsApp"></script>`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
