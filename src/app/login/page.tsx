'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? '/dashboard'

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'tenant' | 'otp'>('phone')
  const [tenants, setTenants] = useState<{ id: string; businessName: string }[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [otpPhone, setOtpPhone] = useState('') // actual phone OTP was sent to
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError('Failed to send OTP. Please try again.')
      return
    }

    if (data.tenants && data.tenants.length > 1) {
      setTenants(data.tenants)
      setSelectedTenantId(data.tenants[0].id)
      setStep('tenant')
    } else {
      if (data.otpPhone) setOtpPhone(data.otpPhone)
      setStep('otp')
    }
  }

  async function handleSelectTenant(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, tenantId: selectedTenantId }),
    })

    const data2 = await res.json()
    setLoading(false)
    if (res.ok) {
      if (data2.otpPhone) setOtpPhone(data2.otpPhone)
      setStep('otp')
    } else {
      setError('Failed to send OTP. Please try again.')
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: otpPhone || phone, code }),
    })

    setLoading(false)
    if (res.ok) {
      window.location.href = from
    } else {
      setError('Invalid or expired code. Please try again.')
    }
  }

  const subtitle =
    step === 'phone' ? 'Enter your owner phone number' :
    step === 'tenant' ? 'Which store do you want to access?' :
    `Enter the code sent to ${phone}`

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Zesto Dashboard</h1>
        <p className="text-sm text-gray-500 mb-6">{subtitle}</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+91 9999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full rounded-lg bg-orange-500 text-white py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'tenant' && (
          <form onSubmit={handleSelectTenant} className="space-y-3">
            {tenants.map(t => (
              <label
                key={t.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedTenantId === t.id
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="tenant"
                  value={t.id}
                  checked={selectedTenantId === t.id}
                  onChange={() => setSelectedTenantId(t.id)}
                  className="accent-orange-500"
                />
                <span className="text-sm font-medium text-gray-800">{t.businessName}</span>
              </label>
            ))}
            <button
              type="submit"
              disabled={loading || !selectedTenantId}
              className="w-full rounded-lg bg-orange-500 text-white py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setError('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Change phone number
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Verification code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 tracking-widest text-center text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full rounded-lg bg-orange-500 text-white py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setStep(tenants.length > 1 ? 'tenant' : 'phone'); setCode(''); setError('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
