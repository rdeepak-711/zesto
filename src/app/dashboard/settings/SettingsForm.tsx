'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tenant = {
  businessName: string
  businessType: string
  address: string | null
  logoUrl: string | null
  ownerPhone: string
  whatsappNumber: string
  currency: string
  minOrderAmount: number
  deliveryDateEnabled?: boolean | null
  deliveryDateLabel?: string | null
  razorpayKeyId?: string | null
  razorpayKeySecret?: string | null
}

export default function SettingsForm({ tenant }: { tenant: Tenant }) {
  const router = useRouter()
  const [form, setForm] = useState({
    businessName: tenant.businessName,
    businessType: tenant.businessType,
    address: tenant.address ?? '',
    logoUrl: tenant.logoUrl ?? '',
    minOrderAmount: (tenant.minOrderAmount / 100).toFixed(0),
    deliveryDateEnabled: tenant.deliveryDateEnabled ?? true,
    deliveryDateLabel: tenant.deliveryDateLabel ?? 'When would you like your order?',
    razorpayKeyId: tenant.razorpayKeyId ?? '',
    razorpayKeySecret: tenant.razorpayKeySecret ?? '',
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
        deliveryDateEnabled: form.deliveryDateEnabled,
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
        <h2 className="text-sm font-bold text-gray-900">Business Info</h2>
        <p className="text-xs text-gray-400 mt-0.5">This info appears in your bot messages and dashboard.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Business Name"
          value={form.businessName}
          onChange={(v) => setForm((f) => ({ ...f, businessName: v }))}
        />
        <Field
          label="Logo URL"
          value={form.logoUrl}
          onChange={(v) => setForm((f) => ({ ...f, logoUrl: v }))}
          placeholder="https://..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
            Business Type
          </label>
          <select
            value={form.businessType}
            onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          >
            <option value="bakery">Bakery</option>
            <option value="restaurant">Restaurant</option>
            <option value="cafe">Cafe</option>
            <option value="grocery">Grocery</option>
            <option value="fashion">Fashion</option>
            <option value="electronics">Electronics</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
            Min Order Amount (₹)
          </label>
          <input
            type="number"
            min="0"
            value={form.minOrderAmount}
            onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
            placeholder="0 (no minimum)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <p className="text-xs text-gray-400 mt-1">Set to 0 to disable.</p>
        </div>
      </div>

      <Field
        label="Address"
        value={form.address}
        onChange={(v) => setForm((f) => ({ ...f, address: v }))}
      />

      {/* Checkout Settings */}
      <div className="border-t border-gray-100 pt-6 mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Checkout Settings</h3>
        <label className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            checked={form.deliveryDateEnabled}
            onChange={(e) => setForm((f) => ({ ...f, deliveryDateEnabled: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Ask customer for delivery / pickup date</span>
        </label>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date prompt (shown to customer)</label>
          <input
            type="text"
            value={form.deliveryDateLabel}
            onChange={(e) => setForm((f) => ({ ...f, deliveryDateLabel: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="When would you like your order?"
          />
        </div>
      </div>

      {/* Integrations */}
      <div className="border-t border-gray-100 pt-6 mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Integrations</h3>
        <p className="text-xs text-gray-400 mb-4">Your Razorpay credentials. Payments go directly to your account.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Razorpay Key ID"
            value={form.razorpayKeyId}
            onChange={(v) => setForm((f) => ({ ...f, razorpayKeyId: v }))}
            placeholder="rzp_live_..."
          />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
              Razorpay Key Secret
            </label>
            <input
              type="password"
              value={form.razorpayKeySecret}
              onChange={(e) => setForm((f) => ({ ...f, razorpayKeySecret: e.target.value }))}
              placeholder="••••••••••••••••"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Get these from your <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Razorpay dashboard</a> → Settings → API Keys.</p>
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
          <span className="text-gray-400">Owner phone</span>
          <span className="text-gray-700 font-medium">{tenant.ownerPhone}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">WhatsApp number</span>
          <span className="text-gray-700 font-medium">{tenant.whatsappNumber}</span>
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
