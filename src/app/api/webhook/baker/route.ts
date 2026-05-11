import { NextResponse } from 'next/server'

// Deprecated — owner management moved to /api/webhook/whatsapp interactive menu
export async function POST() {
  return new NextResponse('', { status: 200 })
}
