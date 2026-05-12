'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = e.currentTarget
    const data = {
      businessName: (form.elements.namedItem('businessName') as HTMLInputElement).value,
      businessType: (form.elements.namedItem('businessType') as HTMLInputElement).value,
      ownerPhone: (form.elements.namedItem('ownerPhone') as HTMLInputElement).value,
      whatsappNumber: (form.elements.namedItem('whatsappNumber') as HTMLInputElement).value,
      currency: (form.elements.namedItem('currency') as HTMLInputElement).value || 'INR',
    }

    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Something went wrong')
        return
      }

      router.push('/onboard/success')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up your store</h1>
        <p className="text-sm text-gray-500 mb-6">Get your WhatsApp ordering bot running in minutes.</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Business name *</label>
            <input name="businessName" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Sweet Bakes" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Business type</label>
            <input name="businessType" defaultValue="bakery" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="bakery" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Your phone number *</label>
            <input name="ownerPhone" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">WhatsApp business number *</label>
            <input name="whatsappNumber" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Currency</label>
            <input name="currency" defaultValue="INR" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="INR" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-2"
          >
            {loading ? 'Setting up...' : 'Get started'}
          </button>
        </form>
      </div>
    </div>
  )
}
