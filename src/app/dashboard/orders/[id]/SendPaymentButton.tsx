'use client'

import { useActionState } from 'react'
import { useEffect, useState } from 'react'

type State = { ok: boolean; error?: string } | null

export default function SendPaymentButton({
  action,
}: {
  action: (prev: State, formData: FormData) => Promise<State>
}) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!state) return
    setToast(
      state.ok
        ? { msg: '💳 Payment link sent via WhatsApp', type: 'success' }
        : { msg: state.error ?? 'Failed to send', type: 'error' }
    )
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [state])

  return (
    <>
      {/* Toast bar */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white rounded-xl py-3 text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Sending…
            </>
          ) : (
            '💳 Request Payment'
          )}
        </button>
      </form>
    </>
  )
}
