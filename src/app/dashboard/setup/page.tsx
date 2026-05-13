'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BotScriptEditor from '@/app/dashboard/bot/BotScriptEditor'

// ── types ──────────────────────────────────────────────────────────────────────

type FieldType = 'select' | 'text' | 'number' | 'boolean'

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  select: 'Multiple choice',
  text: 'Short text',
  number: 'Number',
  boolean: 'Yes / No',
}

type OptionDraft = { label: string; priceDelta: string }

type FieldDraft = {
  name: string
  type: FieldType
  required: boolean
  options: OptionDraft[]
  _optLabel: string
  _optPrice: string
}

type ItemDraft = {
  name: string
  price: string
  description: string
  imageUrl: string
  productUrl: string
}

type CategoryDraft = {
  name: string
  items: ItemDraft[]
  fields: FieldDraft[]
  _itemName: string
  _itemPrice: string
  _itemDesc: string
  _itemImg: string
  _itemProductUrl: string
  _fieldName: string
  _fieldType: FieldType
  _fieldReq: boolean
  _expanded: 'items' | 'fields' | null
}

function newCategory(name = ''): CategoryDraft {
  return {
    name,
    items: [],
    fields: [],
    _itemName: '',
    _itemPrice: '',
    _itemDesc: '',
    _itemImg: '',
    _itemProductUrl: '',
    _fieldName: '',
    _fieldType: 'text',
    _fieldReq: true,
    _expanded: 'items',
  }
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST, UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST, UTC+4)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT, UTC+8)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT, UTC+7)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (MYT, UTC+8)' },
  { value: 'Asia/Jakarta', label: 'Jakarta (WIB, UTC+7)' },
  { value: 'Asia/Karachi', label: 'Karachi (PKT, UTC+5)' },
  { value: 'Asia/Dhaka', label: 'Dhaka (BST, UTC+6)' },
  { value: 'Asia/Colombo', label: 'Colombo (SLST, UTC+5:30)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET, UTC+1)' },
  { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'America/Chicago', label: 'Chicago (CT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT, UTC+11)' },
]

// ── main component ─────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [botMessages, setBotMessages] = useState<{ key: string; label: string; value: string }[]>([])

  // Step 1 — store settings
  const [store, setStore] = useState({
    businessName: '',
    businessType: '',
    address: '',
    logoUrl: '',
    minOrderAmount: '',
    deliveryDateEnabled: false,
    deliveryDateLabel: 'When would you like your order?',
    timezone: 'Asia/Kolkata',
    openDays: '1,2,3,4,5,6',
    openTime: '09:00',
    closeTime: '21:00',
    websiteUrl: '',
    instagramUrl: '',
    facebookUrl: '',
  })

  // Step 2 — menu
  const [categories, setCategories] = useState<CategoryDraft[]>([newCategory()])
  const [_newCatName, setNewCatName] = useState('')

  // ── step 1 ───────────────────────────────────────────────────────────────────

  async function handleStoreNext(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: store.businessName,
        businessType: store.businessType,
        address: store.address,
        logoUrl: store.logoUrl,
        minOrderAmount: Math.round(Number(store.minOrderAmount || 0) * 100),
        deliveryDateEnabled: store.deliveryDateEnabled,
        deliveryDateLabel: store.deliveryDateLabel,
        timezone: store.timezone,
        openDays: store.openDays,
        openTime: store.openTime,
        closeTime: store.closeTime,
        websiteUrl: store.websiteUrl || undefined,
        instagramUrl: store.instagramUrl || undefined,
        facebookUrl: store.facebookUrl || undefined,
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save store settings.'); return }
    setStep(2)
  }

  // ── step 2 — category helpers ─────────────────────────────────────────────────

  const setCats = setCategories

  function updateCat(i: number, patch: Partial<CategoryDraft>) {
    setCats(cs => cs.map((c, j) => j === i ? { ...c, ...patch } : c))
  }

  function addCat() {
    if (!_newCatName.trim()) return
    setCats(cs => [...cs, newCategory(_newCatName.trim())])
    setNewCatName('')
  }

  function removeCat(i: number) {
    setCats(cs => cs.filter((_, j) => j !== i))
  }

  // items
  function addItem(ci: number) {
    const c = categories[ci]
    if (!c._itemName.trim() || !c._itemPrice) return
    updateCat(ci, {
      items: [...c.items, {
        name: c._itemName.trim(),
        price: c._itemPrice,
        description: c._itemDesc,
        imageUrl: c._itemImg,
        productUrl: c._itemProductUrl,
      }],
      _itemName: '', _itemPrice: '', _itemDesc: '', _itemImg: '', _itemProductUrl: '',
    })
  }

  function removeItem(ci: number, ii: number) {
    setCats(cs => cs.map((c, j) => j !== ci ? c : { ...c, items: c.items.filter((_, k) => k !== ii) }))
  }

  // fields
  function addField(ci: number) {
    const c = categories[ci]
    if (!c._fieldName.trim()) return
    updateCat(ci, {
      fields: [...c.fields, {
        name: c._fieldName.trim(),
        type: c._fieldType,
        required: c._fieldReq,
        options: [],
        _optLabel: '',
        _optPrice: '',
      }],
      _fieldName: '', _fieldType: 'text', _fieldReq: true,
    })
  }

  function removeField(ci: number, fi: number) {
    setCats(cs => cs.map((c, j) => j !== ci ? c : { ...c, fields: c.fields.filter((_, k) => k !== fi) }))
  }

  function updateField(ci: number, fi: number, patch: Partial<FieldDraft>) {
    setCats(cs => cs.map((c, j) => j !== ci ? c : {
      ...c,
      fields: c.fields.map((f, k) => k !== fi ? f : { ...f, ...patch }),
    }))
  }

  function addOption(ci: number, fi: number) {
    const f = categories[ci].fields[fi]
    if (!f._optLabel.trim()) return
    updateField(ci, fi, {
      options: [...f.options, { label: f._optLabel.trim(), priceDelta: f._optPrice || '0' }],
      _optLabel: '', _optPrice: '',
    })
  }

  function removeOption(ci: number, fi: number, oi: number) {
    updateField(ci, fi, { options: categories[ci].fields[fi].options.filter((_, k) => k !== oi) })
  }

  // ── step 2 finish ─────────────────────────────────────────────────────────────

  async function handleFinish() {
    const validCats = categories.filter(c => c.name.trim() && c.items.length > 0)
    if (validCats.length === 0) {
      setError('Add at least one category with one item.')
      return
    }

    setSaving(true)
    setError('')

    try {
      for (const cat of validCats) {
        const catRes = await fetch('/api/menu/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cat.name }),
        })
        if (!catRes.ok) throw new Error(`Failed to create category "${cat.name}"`)
        const createdCat = await catRes.json()

        // items
        for (const item of cat.items) {
          await fetch('/api/menu/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.name,
              categoryId: createdCat.id,
              price: Math.round(Number(item.price) * 100),
              description: item.description || undefined,
              imageUrl: item.imageUrl || undefined,
              productUrl: item.productUrl || undefined,
            }),
          })
        }

        // customisation fields
        for (const field of cat.fields) {
          const fieldRes = await fetch(`/api/menu/categories/${createdCat.id}/fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: field.name, type: field.type, required: field.required }),
          })
          if (!fieldRes.ok) continue
          const createdField = await fieldRes.json()

          if (field.type === 'select') {
            for (const opt of field.options) {
              await fetch(`/api/menu/fields/${createdField.id}/options`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  label: opt.label,
                  priceDelta: Math.round(Number(opt.priceDelta || 0) * 100),
                }),
              })
            }
          }
        }
      }

      // Bootstrap default bot messages, then load them for step 3
      await fetch('/api/bootstrap', { method: 'POST' })
      const msgRes = await fetch('/api/bot-messages')
      if (msgRes.ok) {
        const msgs = await msgRes.json()
        setBotMessages(msgs)
      }
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    } finally {
      setSaving(false)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────────

  const validCatCount = categories.filter(c => c.name.trim() && c.items.length > 0).length

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="w-full max-w-2xl mx-auto">

        {/* header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🚀</span>
            <h1 className="text-2xl font-bold text-gray-900">Set up your store</h1>
          </div>
          <p className="text-sm text-gray-500 ml-8">
            Step {step} of 3 — {step === 1 ? 'Store settings' : step === 2 ? 'Menu builder' : 'Bot script'}
          </p>
          <div className="flex gap-2 mt-3">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-orange-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <form onSubmit={handleStoreNext} className="space-y-5">
            <Card title="Store info">
              <Field label="Business name" required>
                <input id="setup-business-name" type="text" required autoFocus
                  value={store.businessName}
                  onChange={e => setStore(s => ({ ...s, businessName: e.target.value }))}
                  placeholder="Sweet Crumbs Bakery"
                  className={inputCls}
                />
              </Field>
              <Field label="Business type">
                <input id="setup-business-type" type="text"
                  value={store.businessType}
                  onChange={e => setStore(s => ({ ...s, businessType: e.target.value }))}
                  placeholder="bakery, cloud kitchen, t-shirt store…"
                  className={inputCls}
                />
              </Field>
              <Field label="Address">
                <input id="setup-address" type="text"
                  value={store.address}
                  onChange={e => setStore(s => ({ ...s, address: e.target.value }))}
                  placeholder="123 Main St, Chennai"
                  className={inputCls}
                />
              </Field>
              <Field label="Logo URL" hint="Paste a public image URL">
                <input id="setup-logo-url" type="url"
                  value={store.logoUrl}
                  onChange={e => setStore(s => ({ ...s, logoUrl: e.target.value }))}
                  placeholder="https://…"
                  className={inputCls}
                />
              </Field>
            </Card>

            <Card title="Ordering rules">
              <Field label="Minimum order amount (₹)" hint="Leave 0 for no minimum">
                <input id="setup-min-order" type="number" min="0" step="1"
                  value={store.minOrderAmount}
                  onChange={e => setStore(s => ({ ...s, minOrderAmount: e.target.value }))}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={store.deliveryDateEnabled}
                  onClick={() => setStore(s => ({ ...s, deliveryDateEnabled: !s.deliveryDateEnabled }))}
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${store.deliveryDateEnabled ? 'bg-orange-500' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${store.deliveryDateEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-gray-700">Ask customers for delivery / pickup date</span>
              </div>
              {store.deliveryDateEnabled && (
                <Field label="Date question to ask customer">
                  <input type="text"
                    value={store.deliveryDateLabel}
                    onChange={e => setStore(s => ({ ...s, deliveryDateLabel: e.target.value }))}
                    placeholder="When would you like your order?"
                    className={inputCls}
                  />
                </Field>
              )}
            </Card>

            <Card title="Opening hours">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Open time">
                  <input type="time" value={store.openTime}
                    onChange={e => setStore(s => ({ ...s, openTime: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Close time">
                  <input type="time" value={store.closeTime}
                    onChange={e => setStore(s => ({ ...s, closeTime: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Timezone">
                <select value={store.timezone}
                  onChange={e => setStore(s => ({ ...s, timezone: e.target.value }))}
                  className={inputCls}>
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
              </Field>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Open days</p>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((day, i) => {
                    const checked = store.openDays.split(',').map(d => d.trim()).includes(String(i))
                    return (
                      <button key={i} type="button"
                        onClick={() => {
                          const days = store.openDays.split(',').map(d => d.trim()).filter(Boolean)
                          const next = checked ? days.filter(d => d !== String(i)) : [...days, String(i)].sort()
                          setStore(s => ({ ...s, openDays: next.join(',') }))
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${checked ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-300 hover:border-orange-400'}`}>
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            </Card>

            <Card title="Social &amp; web presence">
              <Field label="Website" hint="Your store or portfolio URL">
                <input type="url" value={store.websiteUrl}
                  onChange={e => setStore(s => ({ ...s, websiteUrl: e.target.value }))}
                  placeholder="https://sweetcrumbs.in"
                  className={inputCls}
                />
              </Field>
              <Field label="Instagram" hint="Full URL or @handle">
                <input type="text" value={store.instagramUrl}
                  onChange={e => setStore(s => ({ ...s, instagramUrl: e.target.value }))}
                  placeholder="https://instagram.com/sweetcrumbs or @sweetcrumbs"
                  className={inputCls}
                />
              </Field>
              <Field label="Facebook" hint="Page URL (optional)">
                <input type="url" value={store.facebookUrl}
                  onChange={e => setStore(s => ({ ...s, facebookUrl: e.target.value }))}
                  placeholder="https://facebook.com/sweetcrumbs"
                  className={inputCls}
                />
              </Field>
            </Card>

            <button
              type="submit"
              disabled={saving || !store.businessName.trim()}
              className="w-full rounded-xl bg-orange-500 text-white py-3 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Next: Build your menu →'}
            </button>
          </form>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-800">
              These are the messages your WhatsApp bot sends to customers. Edit any message to match your brand voice. You can always change these later from Bot Script in the sidebar.
            </div>
            <BotScriptEditor initialMessages={botMessages} />
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(2)}
                className="rounded-xl border border-gray-300 text-gray-600 px-5 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button type="button" onClick={() => router.push('/dashboard')}
                className="flex-1 rounded-xl bg-orange-500 text-white py-2.5 text-sm font-semibold hover:bg-orange-600 transition-colors">
                Go live →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-sm text-orange-800">
              Add your categories and items. Customers will browse these in WhatsApp. You can always add more later.
            </div>

            {categories.map((cat, ci) => (
              <CategoryCard
                key={ci}
                cat={cat}
                ci={ci}
                onUpdate={p => updateCat(ci, p)}
                onRemove={() => removeCat(ci)}
                onAddItem={() => addItem(ci)}
                onRemoveItem={ii => removeItem(ci, ii)}
                onAddField={() => addField(ci)}
                onRemoveField={fi => removeField(ci, fi)}
                onUpdateField={(fi, p) => updateField(ci, fi, p)}
                onAddOption={fi => addOption(ci, fi)}
                onRemoveOption={(fi, oi) => removeOption(ci, fi, oi)}
              />
            ))}

            {/* add category */}
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Add another category</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={_newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCat())}
                  placeholder="e.g. Cakes, Main Course, Sneakers…"
                  data-testid="new-category-input"
                  className={inputCls + ' flex-1'}
                />
                <button type="button" onClick={addCat} disabled={!_newCatName.trim()}
                  className="rounded-lg bg-orange-500 text-white px-4 text-sm font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors">
                  Add
                </button>
              </div>
            </div>

            {/* footer */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)}
                className="rounded-xl border border-gray-300 text-gray-600 px-5 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                ← Back
              </button>
              <button type="button" onClick={handleFinish}
                disabled={saving || validCatCount === 0}
                data-testid="finish-setup"
                className="flex-1 rounded-xl bg-orange-500 text-white py-2.5 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {saving ? 'Saving menu…' : `Next: Bot script${validCatCount > 0 ? ` (${validCatCount} categor${validCatCount === 1 ? 'y' : 'ies'})` : ''} →`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── shared ─────────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={`setup-${label.toLowerCase().replace(/\s+/g, '-')}`} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="text-xs text-gray-400 font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}

// ── CategoryCard ───────────────────────────────────────────────────────────────

type CatCardProps = {
  cat: CategoryDraft; ci: number
  onUpdate: (p: Partial<CategoryDraft>) => void
  onRemove: () => void
  onAddItem: () => void; onRemoveItem: (ii: number) => void
  onAddField: () => void; onRemoveField: (fi: number) => void
  onUpdateField: (fi: number, p: Partial<FieldDraft>) => void
  onAddOption: (fi: number) => void; onRemoveOption: (fi: number, oi: number) => void
}

function CategoryCard(p: CatCardProps) {
  const { cat, onUpdate } = p
  const tab = cat._expanded

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      data-testid={`category-card-${cat.name}`}>

      {/* header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <span className="text-gray-400 text-sm">📂</span>
        <input type="text" value={cat.name}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Category name"
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none py-0.5"
        />
        <button type="button" onClick={p.onRemove}
          className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none ml-1">×</button>
      </div>

      {/* tabs */}
      <div className="flex border-b border-gray-100">
        {(['items', 'fields'] as const).map(t => (
          <button key={t} type="button"
            onClick={() => onUpdate({ _expanded: tab === t ? null : t })}
            className={`flex-1 text-xs font-medium py-2 transition-colors ${tab === t ? 'text-orange-600 border-b-2 border-orange-500 -mb-px bg-orange-50' : 'text-gray-400 hover:text-gray-600'}`}>
            {t === 'items'
              ? `Items ${cat.items.length > 0 ? `(${cat.items.length})` : '— required'}`
              : `Customisation fields ${cat.fields.length > 0 ? `(${cat.fields.length})` : '— optional'}`}
          </button>
        ))}
      </div>

      {/* items panel */}
      {tab === 'items' && (
        <div className="p-4 space-y-3">
          {cat.items.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No items yet — add your first item below</p>
          )}
          {cat.items.map((item, ii) => (
            <div key={ii} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.name}
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <span className="flex-1 font-medium text-gray-800 truncate">{item.name}</span>
              {item.description && <span className="text-gray-400 text-xs truncate max-w-[120px]">{item.description}</span>}
              {item.productUrl && (
                <a href={item.productUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 text-xs flex-shrink-0 hover:text-blue-600" title={item.productUrl}>🔗</a>
              )}
              <span className="text-orange-600 font-semibold flex-shrink-0">₹{item.price}</span>
              <button type="button" onClick={() => p.onRemoveItem(ii)}
                className="text-gray-300 hover:text-red-400 transition-colors">×</button>
            </div>
          ))}

          {/* add item row */}
          <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <input type="text" value={cat._itemName}
                onChange={e => onUpdate({ _itemName: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), p.onAddItem())}
                placeholder="Item name (e.g. Chocolate Cake)"
                data-testid={`item-name-${cat.name}`}
                className={inputCls + ' flex-1'}
              />
              <input type="number" min="0" step="1" value={cat._itemPrice}
                onChange={e => onUpdate({ _itemPrice: e.target.value })}
                placeholder="₹ Price"
                data-testid={`item-price-${cat.name}`}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex gap-2">
              <input type="text" value={cat._itemDesc}
                onChange={e => onUpdate({ _itemDesc: e.target.value })}
                placeholder="Description (optional)"
                className={inputCls + ' flex-1'}
              />
              <input type="url" value={cat._itemImg}
                onChange={e => onUpdate({ _itemImg: e.target.value })}
                placeholder="Image URL (optional)"
                className={inputCls + ' flex-1'}
              />
            </div>
            <input type="url" value={cat._itemProductUrl}
              onChange={e => onUpdate({ _itemProductUrl: e.target.value })}
              placeholder="Product page URL (optional) — e.g. https://yoursite.com/product"
              className={inputCls}
            />
            <button type="button" onClick={p.onAddItem}
              disabled={!cat._itemName.trim() || !cat._itemPrice}
              data-testid={`add-item-btn-${cat.name}`}
              className="w-full rounded-lg bg-orange-100 text-orange-700 py-1.5 text-xs font-semibold hover:bg-orange-200 disabled:opacity-40 transition-colors">
              + Add Item
            </button>
          </div>
        </div>
      )}

      {/* fields panel */}
      {tab === 'fields' && (
        <div className="p-4 space-y-3">
          {cat.fields.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No fields yet — add questions the bot asks per item (size, flavour, colour…)</p>
          )}
          {cat.fields.map((field, fi) => (
            <FieldRow key={fi} field={field}
              onRemove={() => p.onRemoveField(fi)}
              onUpdate={patch => p.onUpdateField(fi, patch)}
              onAddOption={() => p.onAddOption(fi)}
              onRemoveOption={oi => p.onRemoveOption(fi, oi)}
            />
          ))}

          {/* add field row */}
          <div className="border border-dashed border-gray-200 rounded-lg p-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Add question field</p>
            <div className="flex gap-2 flex-wrap">
              <input type="text" value={cat._fieldName}
                onChange={e => onUpdate({ _fieldName: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), p.onAddField())}
                placeholder="e.g. Flavour, Size, Colour…"
                className={inputCls + ' flex-1 min-w-0'}
              />
              <select value={cat._fieldType}
                onChange={e => onUpdate({ _fieldType: e.target.value as FieldType })}
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map(t => (
                  <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
                <input type="checkbox" checked={cat._fieldReq}
                  onChange={e => onUpdate({ _fieldReq: e.target.checked })}
                  className="rounded accent-orange-500"
                />
                Required
              </label>
              <button type="button" onClick={p.onAddField} disabled={!cat._fieldName.trim()}
                className="rounded-lg bg-orange-100 text-orange-700 px-3 py-2 text-sm font-medium hover:bg-orange-200 disabled:opacity-40 transition-colors whitespace-nowrap">
                + Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── FieldRow ───────────────────────────────────────────────────────────────────

function FieldRow({ field, onRemove, onUpdate, onAddOption, onRemoveOption }: {
  field: FieldDraft
  onRemove: () => void
  onUpdate: (p: Partial<FieldDraft>) => void
  onAddOption: () => void
  onRemoveOption: (oi: number) => void
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <span className="flex-1 text-sm font-medium text-gray-800">{field.name}</span>
        <span className="text-[11px] text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">
          {FIELD_TYPE_LABELS[field.type]}
        </span>
        {field.required && (
          <span className="text-[11px] text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5">required</span>
        )}
        <button type="button" onClick={onRemove}
          className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none">×</button>
      </div>

      {field.type === 'select' && (
        <div className="mt-2 space-y-1.5">
          {field.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="flex-1 bg-white border border-gray-200 rounded-md px-2 py-1">{opt.label}</span>
              {Number(opt.priceDelta) > 0 && (
                <span className="text-green-600 font-medium whitespace-nowrap">+₹{opt.priceDelta}</span>
              )}
              <button type="button" onClick={() => onRemoveOption(oi)}
                className="text-gray-300 hover:text-red-400 transition-colors">×</button>
            </div>
          ))}
          <div className="flex gap-1.5 mt-1.5">
            <input type="text" value={field._optLabel}
              onChange={e => onUpdate({ _optLabel: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAddOption())}
              placeholder="Option label"
              className="flex-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <input type="number" min="0" step="1" value={field._optPrice}
              onChange={e => onUpdate({ _optPrice: e.target.value })}
              placeholder="₹0 extra"
              className="w-20 rounded-md border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button type="button" onClick={onAddOption} disabled={!field._optLabel.trim()}
              className="rounded-md bg-gray-100 text-gray-600 px-2.5 py-1 text-xs font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors">
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
