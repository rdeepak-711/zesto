'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type MenuItem = {
  id: string
  name: string
  price: number
  description: string | null
  available: boolean
}

type Category = {
  id: string
  name: string
  items: MenuItem[]
}

function formatPrice(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`
}

export default function MenuManager({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<MenuItem>>({})
  const [adding, setAdding] = useState<string | null>(null)
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '' })

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
      }),
    })
    setAdding(null)
    setNewItem({ name: '', price: '', description: '' })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <div key={cat.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">{cat.name}</h2>
            <button
              onClick={() => { setAdding(cat.id); setNewItem({ name: '', price: '', description: '' }) }}
              className="text-xs text-orange-500 hover:text-orange-700 font-medium"
            >
              + Add item
            </button>
          </div>

          <div className="divide-y divide-gray-50">
            {cat.items.map((item) => (
              <div key={item.id} className="px-5 py-3">
                {editing === item.id ? (
                  <div className="space-y-2">
                    <input
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      defaultValue={item.name}
                      onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="w-32 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      defaultValue={(item.price / 100).toFixed(2)}
                      onChange={(e) => setEditData((d) => ({ ...d, price: e.target.value as unknown as number }))}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="text-xs bg-orange-500 text-white rounded-lg px-3 py-1.5 hover:bg-orange-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-sm ${item.available ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                        {item.name}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">{formatPrice(item.price)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleAvailability(item)}
                        className={`text-xs font-medium ${item.available ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        {item.available ? 'Available' : 'Hidden'}
                      </button>
                      <button
                        onClick={() => { setEditing(item.id); setEditData({}) }}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {adding === cat.id && (
              <div className="px-5 py-3 bg-orange-50 space-y-2">
                <input
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
                />
                <input
                  type="number"
                  step="0.01"
                  className="w-32 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="Price (₹)"
                  value={newItem.price}
                  onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => addItem(cat.id)}
                    className="text-xs bg-orange-500 text-white rounded-lg px-3 py-1.5 hover:bg-orange-600"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAdding(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
