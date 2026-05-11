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
  minOrderAmount: number
}

export default function SettingsForm({ config }: { config: Config }) {
  const router = useRouter()
  const [form, setForm] = useState({
    bakeryName: config.bakeryName,
    address: config.address ?? '',
    welcomeMessage: config.welcomeMessage,
    logoUrl: config.logoUrl ?? '',
    minOrderAmount: (config.minOrderAmount / 100).toFixed(0),
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
      body: JSON.stringify({
        ...form,
        minOrderAmount: Math.round(Number(form.minOrderAmount || 0) * 100),
      }),
    })
    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Bakery Info</h2>
        <p className="text-xs text-gray-400 mt-0.5">This info appears in your bot messages and dashboard.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Bakery Name"
          value={form.bakeryName}
          onChange={(v) => setForm((f) => ({ ...f, bakeryName: v }))}
        />
        <Field
          label="Logo URL"
          value={form.logoUrl}
          onChange={(v) => setForm((f) => ({ ...f, logoUrl: v }))}
          placeholder="https://..."
        />
      </div>

      <Field
        label="Address"
        value={form.address}
        onChange={(v) => setForm((f) => ({ ...f, address: v }))}
      />

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
          Minimum Order Amount (₹)
        </label>
        <input
          type="number"
          min="0"
          value={form.minOrderAmount}
          onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
          placeholder="0 (no minimum)"
          className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <p className="text-xs text-gray-400 mt-1">Set to 0 to disable minimum order check.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
          Welcome Message
        </label>
        <textarea
          rows={3}
          value={form.welcomeMessage}
          onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
      </div>

      <div className="border border-gray-100 rounded-xl bg-slate-50 p-4 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Baker phone</span>
          <span className="text-gray-700 font-medium">{config.bakerPhone}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">WhatsApp number</span>
          <span className="text-gray-700 font-medium">{config.whatsappNumber}</span>
        </div>
        <p className="text-[11px] text-gray-400 pt-1">Contact support to change phone numbers.</p>
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
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
    </div>
  )
}
