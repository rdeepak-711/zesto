'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type BotMessage = { key: string; label: string; value: string }

type Step = {
  stepNum: number
  title: string
  trigger: string
  triggerColor: string
  messageKeys: string[]
  note?: string
}

const FLOW: Step[] = [
  {
    stepNum: 1,
    title: 'Customer says hi',
    trigger: 'hi / hello / start',
    triggerColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    messageKeys: ['welcome'],
  },
  {
    stepNum: 2,
    title: 'Customer types "menu"',
    trigger: 'menu',
    triggerColor: 'bg-blue-50 text-blue-700 border-blue-200',
    messageKeys: ['menu_header'],
  },
  {
    stepNum: 3,
    title: 'Customer picks a category',
    trigger: 'number or category name',
    triggerColor: 'bg-orange-50 text-orange-700 border-orange-200',
    messageKeys: ['invalid_category', 'items_footer'],
    note: 'The item list itself is generated from your menu. Only the footer text and error message are editable here.',
  },
  {
    stepNum: 4,
    title: 'Customer picks an item',
    trigger: 'number or item name',
    triggerColor: 'bg-orange-50 text-orange-700 border-orange-200',
    messageKeys: ['invalid_item', 'quantity_prompt'],
  },
  {
    stepNum: 5,
    title: 'Customer enters quantity',
    trigger: '1 – 99',
    triggerColor: 'bg-orange-50 text-orange-700 border-orange-200',
    messageKeys: ['invalid_quantity', 'item_added', 'add_more_prompt'],
    note: 'Use {item} for item name, {qty} for quantity, {categories} for category list.',
  },
  {
    stepNum: 6,
    title: 'Customer types "confirm"',
    trigger: 'confirm / done / checkout',
    triggerColor: 'bg-purple-50 text-purple-700 border-purple-200',
    messageKeys: ['order_summary', 'choose_more'],
    note: 'Use {cart} to show cart contents. The choose_more message appears if the customer enters something unexpected.',
  },
  {
    stepNum: 7,
    title: 'Customer confirms order',
    trigger: 'yes / confirm',
    triggerColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    messageKeys: ['order_placed', 'await_confirm'],
    note: 'await_confirm shows if they reply anything other than yes/cancel.',
  },
  {
    stepNum: 8,
    title: 'Customer checks cart',
    trigger: 'cart',
    triggerColor: 'bg-slate-100 text-slate-600 border-slate-200',
    messageKeys: ['cart_empty', 'confirm_hint'],
  },
  {
    stepNum: 9,
    title: 'Customer cancels',
    trigger: 'cancel',
    triggerColor: 'bg-red-50 text-red-700 border-red-200',
    messageKeys: ['cancel'],
  },
  {
    stepNum: 10,
    title: 'Order already placed',
    trigger: 'any message while order pending',
    triggerColor: 'bg-amber-50 text-amber-700 border-amber-200',
    messageKeys: ['order_pending'],
  },
  {
    stepNum: 11,
    title: 'Customer goes back',
    trigger: 'back',
    triggerColor: 'bg-slate-100 text-slate-600 border-slate-200',
    messageKeys: ['back_to_categories'],
  },
]

export default function BotScriptEditor({ initialMessages }: { initialMessages: BotMessage[] }) {
  const router = useRouter()
  const [messages, setMessages] = useState<Record<string, string>>(
    Object.fromEntries(initialMessages.map((m) => [m.key, m.value]))
  )
  const labels = Object.fromEntries(initialMessages.map((m) => [m.key, m.label]))

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  function startEdit(key: string) {
    setEditing(key)
    setDraft(messages[key] ?? '')
  }

  function cancelEdit() {
    setEditing(null)
    setDraft('')
  }

  async function saveEdit(key: string) {
    setSaving(true)
    const res = await fetch(`/api/bot-messages/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: draft }),
    })
    if (res.ok) {
      setMessages((prev) => ({ ...prev, [key]: draft }))
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    }
    setSaving(false)
    setEditing(null)
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {FLOW.map((step) => (
        <div key={step.stepNum} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Step header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
              {step.stepNum}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-gray-900">{step.title}</span>
              {step.note && (
                <p className="text-[11px] text-gray-400 mt-0.5">{step.note}</p>
              )}
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${step.triggerColor} flex-shrink-0`}>
              {step.trigger}
            </span>
          </div>

          {/* Messages */}
          <div className="divide-y divide-gray-50">
            {step.messageKeys.map((key) => (
              <div key={key} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                      {labels[key] ?? key}
                    </div>
                    {editing === key ? (
                      <div className="space-y-2">
                        <textarea
                          rows={Math.max(3, draft.split('\n').length)}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="w-full font-mono text-xs rounded-lg border border-orange-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-orange-50/30"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(key)}
                            disabled={saving}
                            className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        {messages[key]}
                      </pre>
                    )}
                  </div>

                  {editing !== key && (
                    <div className="flex items-center gap-2 flex-shrink-0 pt-[22px]">
                      {saved === key && (
                        <span className="text-[11px] text-emerald-600 font-medium">✓ Saved</span>
                      )}
                      <button
                        onClick={() => startEdit(key)}
                        className="text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
