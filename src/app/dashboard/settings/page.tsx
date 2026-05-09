import { db } from '@/lib/db'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Settings</h1>
      {config ? (
        <SettingsForm config={config} />
      ) : (
        <p className="text-sm text-gray-400">No configuration found.</p>
      )}

      {/* Widget snippet */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Website Widget</h2>
        <p className="text-xs text-gray-500 mb-3">
          Add this snippet to your website to show the WhatsApp order button.
        </p>
        <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
          {`<script src="${process.env.NEXT_PUBLIC_APP_URL}/widget.js" data-zesto data-phone="${config?.whatsappNumber ?? '+91XXXXXXXXXX'}" data-label="Order via WhatsApp"></script>`}
        </pre>
      </div>
    </div>
  )
}
