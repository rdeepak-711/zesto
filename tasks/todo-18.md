# Task 18 — Menu Manager Page (Category + Item CRUD)

**Phase:** 3 — Dashboard  
**Goal:** Baker can add/edit/delete menu categories and items, and toggle item availability without deleting them.

**Files created:**
- `src/app/api/menu/categories/route.ts`
- `src/app/api/menu/categories/[id]/route.ts`
- `src/app/api/menu/items/route.ts`
- `src/app/api/menu/items/[id]/route.ts`
- `src/app/api/menu/items/[id]/toggle/route.ts`
- `src/app/(dashboard)/menu/page.tsx`

---

- [ ] **Step 1: Write `src/app/api/menu/categories/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const categories = await db.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  return NextResponse.json({ categories })
}

export async function POST(request: Request) {
  const { name, sortOrder } = await request.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const category = await db.menuCategory.create({
    data: { name, sortOrder: sortOrder ?? 0 },
  })
  return NextResponse.json({ category }, { status: 201 })
}
```

- [ ] **Step 2: Write `src/app/api/menu/categories/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const category = await db.menuCategory.update({ where: { id }, data: body })
  return NextResponse.json({ category })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.menuCategory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/app/api/menu/items/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const items = await db.menuItem.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const { categoryId, name, description, price, imageUrl, sortOrder } = await request.json()
  if (!categoryId || !name || price == null) {
    return NextResponse.json({ error: 'categoryId, name, price required' }, { status: 400 })
  }
  const item = await db.menuItem.create({
    data: { categoryId, name, description, price, imageUrl, sortOrder: sortOrder ?? 0 },
  })
  return NextResponse.json({ item }, { status: 201 })
}
```

- [ ] **Step 4: Write `src/app/api/menu/items/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const item = await db.menuItem.update({ where: { id }, data: body })
  return NextResponse.json({ item })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.menuItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Write `src/app/api/menu/items/[id]/toggle/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const item = await db.menuItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated = await db.menuItem.update({
    where: { id },
    data: { available: !item.available },
  })
  return NextResponse.json({ item: updated })
}
```

- [ ] **Step 6: Write `src/app/(dashboard)/menu/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { paiseToCurrency, currencyToPaise } from '@/lib/currency'

type MenuItem = { id: string; name: string; price: number; available: boolean; description: string | null }
type Category = { id: string; name: string; items: MenuItem[] }

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [addItemFor, setAddItemFor] = useState<string | null>(null)
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '' })

  async function load() {
    const res = await fetch('/api/menu/categories')
    const data = await res.json()
    setCategories(data.categories)
  }

  useEffect(() => { load() }, [])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim()) return
    await fetch('/api/menu/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName }),
    })
    setNewCatName('')
    load()
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!addItemFor) return
    await fetch('/api/menu/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: addItemFor,
        name: newItem.name,
        description: newItem.description,
        price: currencyToPaise(parseFloat(newItem.price)),
      }),
    })
    setNewItem({ name: '', price: '', description: '' })
    setAddItemFor(null)
    load()
  }

  async function toggleItem(id: string) {
    await fetch(`/api/menu/items/${id}/toggle`, { method: 'PATCH' })
    load()
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item?')) return
    await fetch(`/api/menu/items/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Menu</h1>
        <form onSubmit={addCategory} className="flex gap-2">
          <Input
            placeholder="New category name"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            className="w-48"
          />
          <Button type="submit" size="sm">Add Category</Button>
        </form>
      </div>

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
              <h2 className="font-semibold">{cat.name}</h2>
              <Dialog open={addItemFor === cat.id} onOpenChange={(o) => setAddItemFor(o ? cat.id : null)}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">+ Add Item</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add item to {cat.name}</DialogTitle></DialogHeader>
                  <form onSubmit={addItem} className="space-y-4 mt-2">
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} required />
                    </div>
                    <div className="space-y-1">
                      <Label>Price (₹)</Label>
                      <Input type="number" min="0" step="0.01" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} required />
                    </div>
                    <div className="space-y-1">
                      <Label>Description (optional)</Label>
                      <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
                    </div>
                    <Button type="submit" className="w-full">Add Item</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="divide-y">
              {cat.items.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-400">No items yet.</p>
              )}
              {cat.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className={`text-sm font-medium ${!item.available ? 'line-through text-slate-400' : ''}`}>
                      {item.name}
                    </p>
                    <p className="text-sm text-slate-500">{paiseToCurrency(item.price)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={item.available ? 'outline' : 'secondary'}
                      onClick={() => toggleItem(item.id)}
                    >
                      {item.available ? 'Hide' : 'Show'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteItem(item.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify menu manager works**

```bash
npm run dev
```

Navigate to `http://localhost:3000/menu`. Expected: See the 3 seeded categories (Cakes, Pastries, Cookies) with their items. Try adding a new item — it should appear immediately. Toggle Hide/Show — bot will respect it. Delete an item — it disappears.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/menu/ "src/app/(dashboard)/menu/page.tsx"
git commit -m "feat: menu manager with category and item CRUD, availability toggle"
```
