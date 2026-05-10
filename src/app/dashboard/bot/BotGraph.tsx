'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type BotMessage = { key: string; label: string; value: string }
type BotRule = {
  id: number; label: string; state: string; condition: string
  matchText: string; reply: string; nextState: string; active: boolean
}

const STATE_ORDER = [
  'AWAITING_CATEGORY',
  'AWAITING_ITEM',
  'AWAITING_QUANTITY',
  'AWAITING_MORE',
  'AWAITING_CONFIRMATION',
  'ORDER_PENDING',
] as const

const GLOBAL_COMMANDS = [
  { trigger: 'hi / hello / start', description: 'Resets to start, shows categories', state: 'AWAITING_CATEGORY' },
  { trigger: 'menu', description: 'Shows category list from any state', state: 'AWAITING_CATEGORY' },
  { trigger: 'cart', description: 'Shows current cart contents', state: '(same)' },
  { trigger: 'cancel', description: 'Clears cart, back to IDLE', state: 'IDLE' },
]

const NODE_META: Record<string, {
  label: string
  color: string
  bg: string
  border: string
  dot: string
  connector: string
  messageKeys: string[]
  transitions: Array<{ label: string; to?: string; loop?: boolean }>
}> = {
  AWAITING_CATEGORY: {
    label: 'Choose Category',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    connector: 'hi / hello / any message',
    messageKeys: ['welcome', 'invalid_category'],
    transitions: [
      { label: 'valid number or name', to: 'AWAITING_ITEM' },
      { label: 'invalid input', loop: true },
    ],
  },
  AWAITING_ITEM: {
    label: 'Choose Item',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    connector: 'valid category',
    messageKeys: ['items_footer', 'invalid_item'],
    transitions: [
      { label: 'valid number or name', to: 'AWAITING_QUANTITY' },
      { label: 'back', to: 'AWAITING_CATEGORY' },
      { label: 'invalid input', loop: true },
    ],
  },
  AWAITING_QUANTITY: {
    label: 'Enter Quantity',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    connector: 'valid item',
    messageKeys: ['quantity_prompt', 'invalid_quantity'],
    transitions: [
      { label: '1 – 99', to: 'AWAITING_MORE' },
      { label: 'invalid number', loop: true },
    ],
  },
  AWAITING_MORE: {
    label: 'Add More?',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    connector: 'quantity entered',
    messageKeys: ['item_added', 'add_more_prompt', 'choose_more'],
    transitions: [
      { label: 'confirm / done', to: 'AWAITING_CONFIRMATION' },
      { label: 'category number', to: 'AWAITING_ITEM' },
      { label: 'invalid', loop: true },
    ],
  },
  AWAITING_CONFIRMATION: {
    label: 'Confirm Order',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    connector: 'confirm',
    messageKeys: ['order_summary', 'await_confirm'],
    transitions: [
      { label: 'yes', to: 'ORDER_PENDING' },
      { label: 'cancel / no', to: 'IDLE' },
      { label: 'other', loop: true },
    ],
  },
  ORDER_PENDING: {
    label: 'Order Placed',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
    connector: 'yes / confirm',
    messageKeys: ['order_placed', 'order_pending'],
    transitions: [
      { label: 'any message', loop: true },
    ],
  },
}

const STATE_LABELS: Record<string, string> = {
  '*': 'Any state',
  AWAITING_CATEGORY: 'Choose Category',
  AWAITING_ITEM: 'Choose Item',
  AWAITING_QUANTITY: 'Enter Quantity',
  AWAITING_MORE: 'Add More?',
  AWAITING_CONFIRMATION: 'Confirm Order',
  ORDER_PENDING: 'Order Placed',
  IDLE: 'IDLE',
  SAME: 'Stay in same state',
}

const STATES_FOR_RULE = ['*', ...STATE_ORDER, 'IDLE']
const NEXT_STATES_FOR_RULE = ['SAME', ...STATE_ORDER, 'IDLE']
const CONDITIONS = ['contains', 'equals', 'starts_with']

// ─── Message Edit Inline ──────────────────────────────────────────────────────

function MessageCard({
  msgKey,
  messages,
  labels,
  onSave,
}: {
  msgKey: string
  messages: Record<string, string>
  labels: Record<string, string>
  onSave: (key: string, value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(messages[msgKey] ?? '')
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
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {labels[msgKey] ?? msgKey}
        </span>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[10px] text-emerald-600 font-medium">✓ saved</span>}
          {!editing && (
            <button
              onClick={() => { setDraft(messages[msgKey] ?? ''); setEditing(true) }}
              className="text-[11px] text-orange-500 hover:text-orange-600 font-medium"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            rows={Math.max(2, draft.split('\n').length)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full font-mono text-[11px] rounded-lg border border-orange-300 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-orange-50/40"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="text-[11px] font-semibold bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-[11px] text-gray-500 hover:text-gray-700 px-2.5 py-1 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <pre className="text-[11px] text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-white/70 rounded-lg px-2.5 py-2 border border-gray-100">
          {messages[msgKey]}
        </pre>
      )}
    </div>
  )
}

// ─── Flow Node ────────────────────────────────────────────────────────────────

function FlowNode({
  state,
  messages,
  labels,
  onSaveMessage,
  rules,
}: {
  state: string
  messages: Record<string, string>
  labels: Record<string, string>
  onSaveMessage: (key: string, value: string) => Promise<void>
  rules: BotRule[]
}) {
  const [open, setOpen] = useState(false)
  const meta = NODE_META[state]
  const nodeRules = rules.filter((r) => r.active && (r.state === state || r.state === '*'))

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left rounded-2xl border-2 ${meta.border} ${meta.bg} px-4 py-3 transition-all hover:shadow-md`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${meta.dot} flex-shrink-0`} />
          <span className={`text-sm font-bold ${meta.color}`}>{meta.label}</span>
          <span className="text-[10px] font-mono text-gray-400 ml-auto">{state}</span>
          <span className="text-gray-400 text-xs ml-2">{open ? '▲' : '▼'}</span>
        </div>

        {/* Rule badges */}
        {nodeRules.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 ml-5">
            {nodeRules.map((r) => (
              <span key={r.id} className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">
                if "{r.matchText}" → {STATE_LABELS[r.nextState] ?? r.nextState}
              </span>
            ))}
          </div>
        )}
      </button>

      {open && (
        <div className={`mt-1 rounded-2xl border-2 ${meta.border} ${meta.bg} px-4 py-3 space-y-1`}>
          {/* Messages */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Bot messages</p>
          {meta.messageKeys.map((k) => (
            <MessageCard key={k} msgKey={k} messages={messages} labels={labels} onSave={onSaveMessage} />
          ))}

          {/* Transitions */}
          <div className="pt-3 border-t border-gray-200/60 mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Transitions</p>
            <div className="space-y-1">
              {meta.transitions.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-gray-400">→</span>
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{t.label}</span>
                  {t.loop ? (
                    <span className="text-gray-400">↺ stays here</span>
                  ) : (
                    <span className={`font-semibold ${meta.color}`}>→ {STATE_LABELS[t.to!] ?? t.to}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Connector Arrow ─────────────────────────────────────────────────────────

function Connector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-px h-4 bg-gray-300" />
      <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full font-mono">
        {label}
      </span>
      <div className="w-px h-3 bg-gray-300" />
      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-300" />
    </div>
  )
}

// ─── Rules Manager ────────────────────────────────────────────────────────────

function RulesManager({
  initialRules,
  onUpdate,
}: {
  initialRules: BotRule[]
  onUpdate: (rules: BotRule[]) => void
}) {
  const [rules, setRules] = useState(initialRules)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    label: '', state: '*', condition: 'contains',
    matchText: '', reply: '', nextState: 'SAME',
  })
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function addRule() {
    if (!form.label || !form.matchText || !form.reply) return
    setSaving(true)
    const res = await fetch('/api/bot-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const rule = await res.json()
    const next = [...rules, rule]
    setRules(next)
    onUpdate(next)
    setAdding(false)
    setForm({ label: '', state: '*', condition: 'contains', matchText: '', reply: '', nextState: 'SAME' })
    setSaving(false)
    router.refresh()
  }

  async function toggleRule(id: number, active: boolean) {
    await fetch(`/api/bot-rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    const next = rules.map((r) => r.id === id ? { ...r, active } : r)
    setRules(next)
    onUpdate(next)
    router.refresh()
  }

  async function deleteRule(id: number) {
    await fetch(`/api/bot-rules/${id}`, { method: 'DELETE' })
    const next = rules.filter((r) => r.id !== id)
    setRules(next)
    onUpdate(next)
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Custom Rules</h2>
          <p className="text-xs text-gray-400 mt-0.5">Run before all normal logic — first match wins</p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-1.5 rounded-xl transition-colors"
        >
          + Add Rule
        </button>
      </div>

      {adding && (
        <div className="px-5 py-4 border-b border-orange-100 bg-orange-50/40 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 block mb-1">Rule name</span>
              <input
                type="text"
                placeholder="e.g. Urgent order shortcut"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </label>
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 block mb-1">When in state</span>
              <select
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                {STATES_FOR_RULE.map((s) => (
                  <option key={s} value={s}>{STATE_LABELS[s] ?? s}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 block mb-1">Condition</span>
              <select
                value={form.condition}
                onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 block mb-1">Match text</span>
              <input
                type="text"
                placeholder="e.g. urgent"
                value={form.matchText}
                onChange={(e) => setForm((f) => ({ ...f, matchText: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </label>
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 block mb-1">Go to state</span>
              <select
                value={form.nextState}
                onChange={(e) => setForm((f) => ({ ...f, nextState: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                {NEXT_STATES_FOR_RULE.map((s) => (
                  <option key={s} value={s}>{STATE_LABELS[s] ?? s}</option>
                ))}
              </select>
            </label>
            <label className="col-span-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 block mb-1">Bot reply</span>
              <textarea
                rows={3}
                placeholder="What the bot says when this rule matches…"
                value={form.reply}
                onChange={(e) => setForm((f) => ({ ...f, reply: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addRule}
              disabled={saving || !form.label || !form.matchText || !form.reply}
              className="text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Rule'}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 && !adding ? (
        <p className="text-sm text-gray-400 text-center py-8">No custom rules yet. Add one to create special paths.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {rules.map((rule) => (
            <div key={rule.id} className={`px-5 py-3 flex items-start gap-3 ${!rule.active ? 'opacity-50' : ''}`}>
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${rule.active ? 'bg-orange-500' : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">{rule.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{STATE_LABELS[rule.state] ?? rule.state}</span>
                  {' '}&nbsp;
                  <span>{rule.condition.replace('_', ' ')}</span>
                  {' '}&nbsp;
                  <span className="font-mono bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-100">"{rule.matchText}"</span>
                  {' → '}
                  <span className="font-semibold text-gray-700">{STATE_LABELS[rule.nextState] ?? rule.nextState}</span>
                </div>
                <pre className="text-[11px] text-gray-500 font-sans mt-1 whitespace-pre-wrap leading-relaxed line-clamp-2">{rule.reply}</pre>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                <button
                  onClick={() => toggleRule(rule.id, !rule.active)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                    rule.active
                      ? 'border-gray-200 text-gray-500 hover:text-gray-700'
                      : 'border-orange-200 text-orange-500 hover:text-orange-600'
                  }`}
                >
                  {rule.active ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-xs font-medium text-red-400 hover:text-red-600 px-2.5 py-1 rounded-lg border border-red-100 hover:border-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BotGraph({
  initialMessages,
  initialRules,
}: {
  initialMessages: BotMessage[]
  initialRules: BotRule[]
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<Record<string, string>>(
    Object.fromEntries(initialMessages.map((m) => [m.key, m.value]))
  )
  const labels = Object.fromEntries(initialMessages.map((m) => [m.key, m.label]))
  const [rules, setRules] = useState(initialRules)

  async function saveMessage(key: string, value: string) {
    await fetch(`/api/bot-messages/${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    setMessages((prev) => ({ ...prev, [key]: value }))
    router.refresh()
  }

  return (
    <div className="flex gap-6 items-start">
      {/* ── Left: Graph ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Start node */}
        <div className="flex justify-center mb-1">
          <div className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            START
          </div>
        </div>

        {STATE_ORDER.map((state, i) => (
          <div key={state}>
            <Connector label={NODE_META[state].connector} />
            <FlowNode
              state={state}
              messages={messages}
              labels={labels}
              onSaveMessage={saveMessage}
              rules={rules}
            />
            {state === 'AWAITING_CONFIRMATION' && (
              <div className="flex items-center justify-center gap-6 mt-1 mb-1">
                <div className="flex flex-col items-center">
                  <div className="w-px h-3 bg-gray-300" />
                  <span className="text-[10px] font-mono text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">yes</span>
                  <div className="w-px h-3 bg-gray-300" />
                  <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-300" />
                </div>
                <div className="flex flex-col items-center opacity-50">
                  <div className="w-px h-3 bg-red-300" />
                  <span className="text-[10px] font-mono text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">cancel / no → IDLE</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* End node */}
        <div className="flex justify-center mt-1">
          <div className="bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
            Baker reviews → ACCEPTED / REJECTED
          </div>
        </div>
      </div>

      {/* ── Right: Sidebar ──────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 space-y-4">
        {/* Global commands */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Global commands</h3>
            <p className="text-xs text-gray-400 mt-0.5">Work from any state</p>
          </div>
          <div className="divide-y divide-gray-50">
            {GLOBAL_COMMANDS.map((cmd) => (
              <div key={cmd.trigger} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                    {cmd.trigger}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    → {cmd.state}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{cmd.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Global messages */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Cart & cancel messages</h3>
          </div>
          <div className="px-4 py-3 space-y-2">
            {['cart_empty', 'confirm_hint', 'cancel', 'back_to_categories'].map((k) => (
              <MessageCard key={k} msgKey={k} messages={messages} labels={labels} onSave={saveMessage} />
            ))}
          </div>
        </div>

        {/* Rules */}
        <RulesManager initialRules={initialRules} onUpdate={setRules} />
      </div>
    </div>
  )
}
