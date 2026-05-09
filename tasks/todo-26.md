# Task 26 — Settings Page (Bakery Config)

**Phase:** 5 — Analytics + Widget  
**Goal:** Baker can update their bakery name, welcome message, and address from the dashboard. Also shows the embed widget snippet for easy copy-paste.

**Files created:**
- `src/app/api/settings/route.ts`
- `src/app/(dashboard)/settings/page.tsx`

---

- [ ] **Step 1: Write `src/app/api/settings/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })
  return NextResponse.json({ config })
}

export async function PATCH(request: Request) {
  const { bakeryName, welcomeMessage, address, logoUrl } = await request.json()

  const config = await db.bakeryConfig.update({
    where: { id: 1 },
    data: {
      ...(bakeryName && { bakeryName }),
      ...(welcomeMessage && { welcomeMessage }),
      ...(address !== undefined && { address }),
      ...(logoUrl !== undefined && { logoUrl }),
    },
  })

  return NextResponse.json({ config })
}
```

- [ ] **Step 2: Write `src/app/(dashboard)/settings/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Config = {
  bakeryName: string
  bakerPhone: string
  whatsappNumber: string
  address: string | null
  welcomeMessage: string
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [form, setForm] = useState({ bakeryName: '', welcomeMessage: '', address: '' })
  const [saved, setSaved] = useState(false)
  const [appUrl, setAppUrl] = useState('')

  useEffect(() => {
    setAppUrl(window.location.origin)
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.config)
        setForm({
          bakeryName: d.config.bakeryName,
          welcomeMessage: d.config.welcomeMessage,
          address: d.config.address ?? '',
        })
      })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const widgetSnippet = config
    ? `<script src="${appUrl}/widget.js"\n        data-phone="${config.whatsappNumber}"\n        data-message="Hi! I'd like to order from ${config.bakeryName}."\n        data-position="bottom-right">\n</script>`
    : ''

  if (!config) return <p className="text-slate-500">Loading…</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bakery Info</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label>Bakery Name</Label>
              <Input
                value={form.bakeryName}
                onChange={(e) => setForm({ ...form, bakeryName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp Welcome Message</Label>
              <Input
                value={form.welcomeMessage}
                onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
              />
              <p className="text-xs text-slate-400">Shown to customers when they first message you.</p>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 MG Road, Bangalore"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-500">Baker Phone (login)</Label>
              <Input value={config.bakerPhone} disabled className="bg-slate-50" />
              <p className="text-xs text-slate-400">Contact support to change the login phone number.</p>
            </div>
            <Button type="submit">{saved ? 'Saved ✓' : 'Save Changes'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embed Widget</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-3">
            Add this code to your website's <code className="bg-slate-100 px-1 rounded">&lt;body&gt;</code> tag to show the WhatsApp order button.
          </p>
          <div className="relative">
            <pre className="bg-slate-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre">
              {widgetSnippet}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2 text-xs"
              onClick={() => navigator.clipboard.writeText(widgetSnippet)}
            >
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify settings page**

```bash
npm run dev
```

Navigate to `http://localhost:3000/settings`. Expected:
- Bakery name and welcome message are pre-filled from seed data
- Save updates them in the DB (verify in Prisma Studio)
- Embed widget snippet shows correct WhatsApp number and app URL

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/route.ts "src/app/(dashboard)/settings/page.tsx"
git commit -m "feat: settings page with bakery config editor and widget embed snippet"
```
