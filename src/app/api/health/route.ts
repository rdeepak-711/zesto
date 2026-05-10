import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    const config = await db.bakeryConfig.findUnique({ where: { id: 1 } })
    return NextResponse.json({ status: 'ok', db: 'connected', bakerPhone: config?.bakerPhone })
  } catch {
    return NextResponse.json({ status: 'error', db: 'disconnected' }, { status: 503 })
  }
}
