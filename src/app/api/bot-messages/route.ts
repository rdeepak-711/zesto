import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const messages = await db.botMessage.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json(messages)
}
