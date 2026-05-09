'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Config = {
  bakeryName: string
  address: string | null
  welcomeMessage: string
  logoUrl: string | null
  bakerPhone: string
  whatsappNumber: string
}

export default function SettingsForm({ config }: { config: Config }) {
  const router = useRouter()
  const [form, setForm] = useState({
    bakeryName: config.bakeryName,
    address: config.address ?? '',
    welcomeMessage: config.welcomeMessage,
    logoUrl: config.logoUrl ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <Field
        label="Bakery Name"
        value={form.bakeryName}
        onChange={(v) => setForm((f) => ({ ...f, bakeryName: v }))}
      />
      <Field
        label="Address"
        value={form.address}
        onChange={(v) => setForm((f) => ({ ...f, address: v }))}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
        <textarea
          rows={3}
          value={form.welcomeMessage}
          onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
        />
      </div>
      <Field
        label="Logo URL"
        value={form.logoUrl}
        onChange={(v) => setForm((f) => ({ ...f, logoUrl: v }))}
        placeholder="https://..."
      />

      <div className="pt-1 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>

      <div className="pt-2 border-t border-gray-100 space-y-1">
        <p className="text-xs text-gray-500">
          <span className="font-medium">Baker phone:</span> {config.bakerPhone}
        </p>
        <p className="text-xs text-gray-500">
          <span className="font-medium">WhatsApp number:</span> {config.whatsappNumber}
        </p>
        <p className="text-xs text-gray-400">Contact support to change phone numbers.</p>
      </div>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
      />
    </div>
  )
}
