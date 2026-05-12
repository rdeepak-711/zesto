export default function OnboardSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your store has been created. Contact support to connect your WhatsApp number and start taking orders.
        </p>
        <a href="/login" className="inline-block bg-blue-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-blue-700">
          Go to dashboard
        </a>
      </div>
    </div>
  )
}
