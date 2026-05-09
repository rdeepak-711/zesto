# Task 17 — Conversation Inbox Page

**Phase:** 3 — Dashboard  
**Goal:** Show all WhatsApp conversations grouped by customer phone number, with the last message preview and timestamp.

**Files created:**
- `src/app/(dashboard)/conversations/page.tsx`
- `src/app/api/messages/route.ts`

---

- [ ] **Step 1: Write `src/app/api/messages/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')

  if (phone) {
    // Full thread for one customer
    const messages = await db.message.findMany({
      where: { customerPhone: phone },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ messages })
  }

  // Latest message per customer (inbox view)
  const latest = await db.message.findMany({
    distinct: ['customerPhone'],
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ conversations: latest })
}
```

- [ ] **Step 2: Write `src/app/(dashboard)/conversations/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

type Message = {
  id: string
  customerPhone: string
  body: string
  direction: 'IN' | 'OUT'
  createdAt: string
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Message[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [thread, setThread] = useState<Message[]>([])

  useEffect(() => {
    fetch('/api/messages')
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
  }, [])

  async function openThread(phone: string) {
    setSelected(phone)
    const res = await fetch(`/api/messages?phone=${encodeURIComponent(phone)}`)
    const data = await res.json()
    setThread(data.messages ?? [])
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Inbox list */}
      <div className="w-72 bg-white border rounded-lg overflow-y-auto shrink-0">
        <div className="p-3 border-b">
          <h2 className="font-semibold text-sm">Conversations</h2>
        </div>
        {conversations.length === 0 && (
          <p className="p-4 text-sm text-slate-400">No conversations yet.</p>
        )}
        {conversations.map((msg) => (
          <button
            key={msg.customerPhone}
            onClick={() => openThread(msg.customerPhone)}
            className={`w-full text-left p-3 border-b hover:bg-slate-50 transition-colors ${
              selected === msg.customerPhone ? 'bg-slate-100' : ''
            }`}
          >
            <p className="text-sm font-medium truncate">{msg.customerPhone}</p>
            <p className="text-xs text-slate-400 truncate mt-0.5">{msg.body}</p>
            <p className="text-xs text-slate-300 mt-0.5">
              {new Date(msg.createdAt).toLocaleString('en-IN')}
            </p>
          </button>
        ))}
      </div>

      {/* Thread view */}
      <div className="flex-1 bg-white border rounded-lg flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="p-3 border-b">
              <p className="font-medium text-sm">{selected}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {thread.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-xs text-sm p-2 rounded-lg ${
                    msg.direction === 'IN'
                      ? 'bg-slate-100 text-slate-800'
                      : 'bg-green-100 text-green-900 ml-auto text-right'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Navigate to `http://localhost:3000/conversations`. If you've sent WhatsApp messages (Task 08/09), you should see them here. Click a conversation to see the full thread.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/messages/route.ts "src/app/(dashboard)/conversations/page.tsx"
git commit -m "feat: add conversation inbox with WhatsApp thread view"
```
