'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type BotMessage = { key: string; label: string; value: string }

const STEPS = [
  {
    num: 1,
    title: 'Customer says hi',
    trigger: 'any first message',
    triggerColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    keys: [{ key: 'welcome', hint: undefined }],
  },
  {
    num: 2,
    title: 'Customer asks about your product',
    trigger: 'message contains keyword',
    triggerColor: 'bg-orange-50 text-orange-700 border-orange-200',
    keys: [
      { key: 'enquiry_keywords', hint: 'Comma-separated. Bot shows catalog when any keyword matches.' },
      { key: 'enquiry_frame', hint: 'Use {pricing} — auto-filled with your full menu list.' },
    ],
  },
  {
    num: 3,
    title: 'Customer asks anything else',
    trigger: 'no keyword match',
    triggerColor: 'bg-slate-100 text-slate-600 border-slate-200',
    keys: [{ key: 'enquiry_other', hint: undefined }],
  },
]

function MessageField({
  msgKey,
  label,
  value,
  hint,
  onSave,
}: {
  msgKey: string
  label: string
  value: string
  hint?: string
  onSave: (key: string, val: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await onSave(msgKey, draft)
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">{label}</span>
          <span className="font-mono text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">{msgKey}</span>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[10px] text-emerald-600 font-semibold">✓ Saved</span>}
          {!editing && (
            <button
              onClick={() => { setDraft(value); setEditing(true) }}
              className="text-[11px] font-semibold text-orange-500 hover:text-orange-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            rows={Math.max(2, draft.split('\n').length + 1)}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            className="w-full font-mono text-xs rounded-lg border border-orange-300 bg-orange-50/30 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none leading-relaxed"
          />
          {hint && (
            <p className="text-[10px] text-gray-400 border-l-2 border-gray-200 pl-2 leading-snug">{hint}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre className="text-[11px] text-gray-600 font-sans whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          {value || <span className="text-gray-300 italic">empty</span>}
        </pre>
      )}
    </div>
  )
}

export default function BotEnquiryEditor({ initialMessages }: { initialMessages: BotMessage[] }) {
  const router = useRouter()
  const [messages, setMessages] = useState<Record<string, string>>(
    Object.fromEntries(initialMessages.map(m => [m.key, m.value]))
  )
  const labels = Object.fromEntries(initialMessages.map(m => [m.key, m.label]))
  const [openStep, setOpenStep] = useState<number>(1)

  async function saveMessage(key: string, value: string) {
    await fetch(`/api/bot-messages/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    setMessages(prev => ({ ...prev, [key]: value }))
    router.refresh()
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {STEPS.map(step => {
        const isOpen = openStep === step.num
        return (
          <div
            key={step.num}
            className={`bg-white border rounded-xl overflow-hidden transition-all ${
              isOpen ? 'border-orange-400 shadow-[0_0_0_3px_rgba(249,115,22,0.08)]' : 'border-gray-200'
            }`}
          >
            {/* Header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              onClick={() => setOpenStep(isOpen ? -1 : step.num)}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors ${
                isOpen ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">{step.title}</div>
                <div className="text-[11px] font-mono text-gray-400 mt-0.5">{step.trigger}</div>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${step.triggerColor}`}>
                {step.trigger}
              </span>
              <span className={`text-xs text-gray-300 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {/* Body */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-4">
                {step.keys.map(({ key, hint }) => (
                  <MessageField
                    key={key}
                    msgKey={key}
                    label={labels[key] ?? key}
                    value={messages[key] ?? ''}
                    hint={hint}
                    onSave={saveMessage}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
