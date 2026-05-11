'use client'

import { useState } from 'react'

type DiscountCode = {
  id: number
  code: string
  type: string
  value: number
  minAmount: number
  maxUses: number
  usedCount: number
  active: boolean
  expiresAt: Date | null
  createdAt: Date
}

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(0)}`
}

export default function DiscountManager({ codes: initial }: { codes: DiscountCode[] }) {
  const [codes, setCodes] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: '',
    type: 'percent',
    value: '',
    minAmount: '',
    maxUses: '',
    expiresAt: '',
  })

  function reset() {
    setForm({ code: '', type: 'percent', value: '', minAmount: '', maxUses: '', expiresAt: '' })
    setError(null)
    setShowForm(false)
  }

  async function handleCreate() {
    setError(null)
    if (!form.code.trim() || !form.value) {
      setError('Code and value are required.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          type: form.type,
          value: form.type === 'percent' ? Number(form.value) : Math.round(Number(form.value) * 100),
          minAmount: form.minAmount ? Math.round(Number(form.minAmount) * 100) : 0,
          maxUses: form.maxUses ? Number(form.maxUses) : 0,
          expiresAt: form.expiresAt || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to create')
      }
      const created = await res.json()
      setCodes([created, ...codes])
      reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(id: number, active: boolean) {
    const res = await fetch(`/api/discounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCodes(codes.map((c) => (c.id === id ? updated : c)))
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this discount code?')) return
    await fetch(`/api/discounts/${id}`, { method: 'DELETE' })
    setCodes(codes.filter((c) => c.id !== id))
  }

  function describeDiscount(c: DiscountCode) {
    const val = c.type === 'percent' ? `${c.value}% off` : `${formatPrice(c.value)} off`
    const min = c.minAmount > 0 ? ` on orders over ${formatPrice(c.minAmount)}` : ''
    const uses = c.maxUses > 0 ? ` · ${c.usedCount}/${c.maxUses} used` : ` · ${c.usedCount} used`
    return val + min + uses
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New Code
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Create Discount Code</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER20"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40"
              >
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {form.type === 'percent' ? 'Discount %' : 'Discount ₹'}
              </label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === 'percent' ? '20' : '100'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Order ₹ (optional)</label>
              <input
                type="number"
                value={form.minAmount}
                onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                placeholder="500"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Uses (0 = unlimited)</label>
              <input
                type="number"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expires (optional)</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Creating…' : 'Create Code'}
            </button>
            <button
              onClick={reset}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {codes.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No discount codes yet. Create one to get started.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-50">
            {codes.map((c) => {
              const expired = c.expiresAt && new Date(c.expiresAt) < new Date()
              const exhausted = c.maxUses > 0 && c.usedCount >= c.maxUses
              return (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-bold text-sm text-gray-900">{c.code}</span>
                      {!c.active && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-semibold">
                          Inactive
                        </span>
                      )}
                      {expired && (
                        <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-semibold">
                          Expired
                        </span>
                      )}
                      {exhausted && (
                        <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">
                          Exhausted
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{describeDiscount(c)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(c.id, c.active)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${
                        c.active
                          ? 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                          : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {c.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
