'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type MenuItemVariant = {
  id: string
  name: string
  priceDelta: number
  sortOrder: number
}

type MenuItem = {
  id: string
  name: string
  price: number
  description: string | null
  imageUrl: string | null
  productUrl?: string | null
  available: boolean
  variants: MenuItemVariant[]
}

type Category = {
  id: string
  name: string
  isCustom: boolean
  items: MenuItem[]
}

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`
}

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400'

const SENTINEL_CAT = 'cat-custom'

export default function MenuManager({ categories: initial }: { categories: Category[] }) {
  const router = useRouter()
  const [categories, setCategories] = useState(initial)

  // Item state
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<MenuItem>>({})
  const [adding, setAdding] = useState<string | null>(null)
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '', imageUrl: '', productUrl: '' })

  // Variant state
  const [expandedVariants, setExpandedVariants] = useState<string | null>(null)
  const [newVariant, setNewVariant] = useState({ name: '', priceDelta: '' })
  const [variantSaving, setVariantSaving] = useState(false)

  async function addVariant(itemId: string) {
    if (!newVariant.name.trim()) return
    setVariantSaving(true)
    const res = await fetch(`/api/menu/items/${itemId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newVariant.name.trim(),
        priceDelta: Math.round(Number(newVariant.priceDelta || 0) * 100),
      }),
    })
    const variant = await res.json()
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        items: c.items.map((i) =>
          i.id === itemId ? { ...i, variants: [...i.variants, variant] } : i
        ),
      }))
    )
    setNewVariant({ name: '', priceDelta: '' })
    setVariantSaving(false)
  }

  async function deleteVariant(itemId: string, variantId: string) {
    if (!confirm('Delete this variant?')) return
    await fetch(`/api/menu/items/${itemId}/variants/${variantId}`, { method: 'DELETE' })
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        items: c.items.map((i) =>
          i.id === itemId ? { ...i, variants: i.variants.filter((v) => v.id !== variantId) } : i
        ),
      }))
    )
  }

  // Category state
  const [addingCat, setAddingCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatCustom, setNewCatCustom] = useState(false)
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')

  // ── Category CRUD ────────────────────────────────────────────────────────────

  async function addCategory() {
    if (!newCatName.trim()) return
    const res = await fetch('/api/menu/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), isCustom: newCatCustom }),
    })
    const cat = await res.json()
    setCategories((prev) => [...prev, { ...cat, items: [] }])
    setAddingCat(false)
    setNewCatName('')
    setNewCatCustom(false)
    router.refresh()
  }

  async function renameCategory(id: string) {
    if (!editCatName.trim()) return
    await fetch(`/api/menu/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editCatName.trim() }),
    })
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, name: editCatName.trim() } : c))
    setEditingCat(null)
    router.refresh()
  }

  async function deleteCategory(id: string) {
    const cat = categories.find((c) => c.id === id)
    if (cat && cat.items.length > 0) {
      alert('Remove all items in this category first.')
      return
    }
    if (!confirm(`Delete category "${cat?.name}"?`)) return
    await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' })
    setCategories((prev) => prev.filter((c) => c.id !== id))
    router.refresh()
  }

  // ── Item CRUD ────────────────────────────────────────────────────────────────

  async function toggleAvailability(item: MenuItem) {
    await fetch(`/api/menu/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !item.available }),
    })
    router.refresh()
  }

  async function saveEdit(itemId: string) {
    const payload = { ...editData }
    if (payload.price !== undefined) payload.price = Math.round(Number(payload.price) * 100)
    await fetch(`/api/menu/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setEditing(null)
    router.refresh()
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Delete this item?')) return
    await fetch(`/api/menu/items/${itemId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function addItem(categoryId: string) {
    if (!newItem.name || !newItem.price) return
    await fetch('/api/menu/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newItem.name,
        categoryId,
        price: Math.round(Number(newItem.price) * 100),
        description: newItem.description || null,
        imageUrl: newItem.imageUrl || null,
        productUrl: newItem.productUrl || null,
      }),
    })
    setAdding(null)
    setNewItem({ name: '', price: '', description: '', imageUrl: '', productUrl: '' })
    router.refresh()
  }

  const visible = categories.filter((c) => c.id !== SENTINEL_CAT)

  return (
    <div className="space-y-6">
      {visible.map((cat) => (
        <div key={cat.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Category header */}
          <div className={`px-5 py-3 border-b border-gray-100 flex items-center justify-between ${cat.isCustom ? 'bg-purple-50' : 'bg-gray-50'}`}>
            {editingCat === cat.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  className="text-sm font-semibold border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && renameCategory(cat.id)}
                  autoFocus
                />
                <button onClick={() => renameCategory(cat.id)} className="text-xs text-orange-500 font-medium">Save</button>
                <button onClick={() => setEditingCat(null)} className="text-xs text-gray-400">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-700">{cat.name}</h2>
                {cat.isCustom && (
                  <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full">
                    ✏️ Custom
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              {!cat.isCustom && (
                <button
                  onClick={() => { setAdding(cat.id); setNewItem({ name: '', price: '', description: '', imageUrl: '', productUrl: '' }) }}
                  className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                >
                  + Add item
                </button>
              )}
              <button
                onClick={() => { setEditingCat(cat.id); setEditCatName(cat.name) }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Rename
              </button>
              <button
                onClick={() => deleteCategory(cat.id)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Custom category — no items, just description */}
          {cat.isCustom ? (
            <div className="px-5 py-4">
              <p className="text-sm text-gray-500">
                When customers select this category, the bot asks them to describe their custom order in free text.
                The request is sent directly to the baker. Price is confirmed manually.
              </p>
              <p className="text-xs text-purple-600 mt-2 font-medium">
                Edit the prompt message in Dashboard → Bot Script → custom_prompt
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {cat.items.map((item) => (
                <div key={item.id} className="px-5 py-3">
                  {editing === item.id ? (
                    <div className="space-y-2">
                      <input
                        className={inputCls}
                        placeholder="Item name"
                        defaultValue={item.name}
                        onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                      />
                      <input
                        type="number"
                        step="0.01"
                        className="w-32 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                        placeholder="Price (₹)"
                        defaultValue={(item.price / 100).toFixed(2)}
                        onChange={(e) => setEditData((d) => ({ ...d, price: e.target.value as unknown as number }))}
                      />
                      <textarea
                        className={inputCls + ' resize-none'}
                        rows={2}
                        placeholder="Description (optional)"
                        defaultValue={item.description ?? ''}
                        onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value || null }))}
                      />
                      <input
                        className={inputCls}
                        placeholder="Image URL (optional)"
                        defaultValue={item.imageUrl ?? ''}
                        onChange={(e) => setEditData((d) => ({ ...d, imageUrl: e.target.value || null }))}
                      />
                      <input
                        className={inputCls}
                        placeholder="Product URL (optional — shown in chat)"
                        defaultValue={item.productUrl ?? ''}
                        onChange={(e) => setEditData((d) => ({ ...d, productUrl: e.target.value || null }))}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(item.id)} className="text-xs bg-orange-500 text-white rounded-lg px-3 py-1.5 hover:bg-orange-600">Save</button>
                        <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {item.imageUrl && (
                            <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${item.available ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{item.name}</span>
                              <span className="text-sm text-gray-500">{formatPrice(item.price)}</span>
                              {item.variants.length > 0 && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-semibold">
                                  {item.variants.length} variant{item.variants.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            {item.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <button onClick={() => toggleAvailability(item)} className={`text-xs font-medium ${item.available ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}>
                            {item.available ? 'Available' : 'Hidden'}
                          </button>
                          <button
                            onClick={() => {
                              setExpandedVariants(expandedVariants === item.id ? null : item.id)
                              setNewVariant({ name: '', priceDelta: '' })
                            }}
                            className="text-xs text-purple-500 hover:text-purple-700"
                          >
                            Variants
                          </button>
                          <button onClick={() => { setEditing(item.id); setEditData({}) }} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
                          <button onClick={() => deleteItem(item.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                        </div>
                      </div>

                      {/* Variants panel */}
                      {expandedVariants === item.id && (
                        <div className="mt-3 ml-0 bg-purple-50 border border-purple-100 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-semibold text-purple-700 mb-2">Variants (e.g. sizes, flavors)</p>
                          {item.variants.length === 0 && (
                            <p className="text-xs text-purple-400 mb-2">No variants yet. Add one below.</p>
                          )}
                          {item.variants.map((v) => (
                            <div key={v.id} className="flex items-center justify-between gap-2 text-xs bg-white rounded px-2.5 py-1.5 border border-purple-100">
                              <span className="font-medium text-gray-700">{v.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500">
                                  {v.priceDelta === 0
                                    ? 'Base price'
                                    : v.priceDelta > 0
                                      ? `+${formatPrice(v.priceDelta)}`
                                      : `-${formatPrice(Math.abs(v.priceDelta))}`}
                                </span>
                                <span className="text-gray-400 font-semibold">
                                  = {formatPrice(item.price + v.priceDelta)}
                                </span>
                                <button
                                  onClick={() => deleteVariant(item.id, v.id)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              className="flex-1 text-xs border border-purple-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
                              placeholder="Variant name (e.g. Small)"
                              value={newVariant.name}
                              onChange={(e) => setNewVariant((n) => ({ ...n, name: e.target.value }))}
                            />
                            <input
                              type="number"
                              step="0.01"
                              className="w-24 text-xs border border-purple-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
                              placeholder="±₹ delta"
                              value={newVariant.priceDelta}
                              onChange={(e) => setNewVariant((n) => ({ ...n, priceDelta: e.target.value }))}
                            />
                            <button
                              onClick={() => addVariant(item.id)}
                              disabled={variantSaving || !newVariant.name.trim()}
                              className="text-xs bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {adding === cat.id && (
                <div className="px-5 py-3 bg-orange-50 space-y-2">
                  <input className={inputCls} placeholder="Item name *" value={newItem.name} onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))} />
                  <input type="number" step="0.01" className="w-32 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400" placeholder="Price (₹) *" value={newItem.price} onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))} />
                  <textarea className={inputCls + ' resize-none'} rows={2} placeholder="Description (optional)" value={newItem.description} onChange={(e) => setNewItem((n) => ({ ...n, description: e.target.value }))} />
                  <input className={inputCls} placeholder="Image URL (optional)" value={newItem.imageUrl} onChange={(e) => setNewItem((n) => ({ ...n, imageUrl: e.target.value }))} />
                  <input className={inputCls} placeholder="Product URL (optional — shown in chat)" value={newItem.productUrl} onChange={(e) => setNewItem((n) => ({ ...n, productUrl: e.target.value }))} />
                  <div className="flex gap-2">
                    <button onClick={() => addItem(cat.id)} className="text-xs bg-orange-500 text-white rounded-lg px-3 py-1.5 hover:bg-orange-600">Add</button>
                    <button onClick={() => setAdding(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add Category */}
      {addingCat ? (
        <div className="bg-white rounded-xl border border-dashed border-orange-300 px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">New Category</p>
          <input
            className={inputCls}
            placeholder="Category name *"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            autoFocus
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newCatCustom}
              onChange={(e) => setNewCatCustom(e.target.checked)}
              className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
            />
            <span className="text-sm text-gray-600">
              Custom order category{' '}
              <span className="text-xs text-gray-400">(customers describe what they want in free text)</span>
            </span>
          </label>
          <div className="flex gap-2">
            <button onClick={addCategory} className="text-sm bg-orange-500 text-white rounded-lg px-4 py-1.5 hover:bg-orange-600 font-medium">Add Category</button>
            <button onClick={() => { setAddingCat(false); setNewCatName(''); setNewCatCustom(false) }} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingCat(true)}
          className="w-full bg-white rounded-xl border border-dashed border-gray-300 px-5 py-3 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
        >
          + Add Category
        </button>
      )}
    </div>
  )
}
