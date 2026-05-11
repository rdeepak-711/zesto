'use client'

import { useState } from 'react'
import Script from 'next/script'

type Order = {
  id: string
  customerName: string
  customerPhone: string
  totalAmount: number
  status: string
}

type BusinessConfig = {
  bakeryName: string
  logoUrl: string | null
}

export default function PayButton({ order, config }: { order: Order; config: BusinessConfig }) {
  const [loading, setLoading] = useState(false)
  const [paid, setPaid] = useState(order.status === 'PAID')
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create payment')

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: config.bakeryName,
        image: config.logoUrl ?? undefined,
        description: `Order #${order.id.slice(0, 8).toUpperCase()}`,
        order_id: data.order_id,
        prefill: {
          name: order.customerName,
          contact: order.customerPhone,
        },
        theme: { color: '#f97316' },
        handler: async function (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            })
            const verifyData = await verifyRes.json()
            if (!verifyRes.ok) throw new Error(verifyData.error ?? 'Verification failed')
            setPaid(true)
          } catch {
            setError('Payment received but verification failed. Please contact us.')
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false)
          },
        },
      }

      // @ts-expect-error Razorpay global from CDN
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response: { error: { description: string } }) {
        setError(response.error?.description ?? 'Payment failed. Please try again.')
        setLoading(false)
      })
      rzp.open()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (paid) {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-emerald-700">Payment Successful!</h2>
        <p className="text-gray-500 mt-2">Thank you! Your order is being prepared.</p>
      </div>
    )
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="beforeInteractive" />
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
          <div className="flex justify-between mb-1">
            <span>Order</span>
            <span className="font-mono font-semibold">#{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between font-bold text-base text-gray-900">
            <span>Total</span>
            <span>₹{(order.totalAmount / 100).toFixed(0)}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-base py-4 rounded-xl transition-colors"
        >
          {loading ? 'Opening payment…' : `Pay ₹${(order.totalAmount / 100).toFixed(0)}`}
        </button>

        <p className="text-xs text-center text-gray-400">
          Secured by Razorpay. Supports UPI, cards, netbanking & wallets.
        </p>
      </div>
    </>
  )
}
