import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const codes = await db.discountCode.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(codes)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { code, type, value, minAmount = 0, maxUses = 0, expiresAt } = body

  if (!code?.trim() || !type || value === undefined) {
    return NextResponse.json({ error: 'code, type, and value are required' }, { status: 400 })
  }

  const existing = await db.discountCode.findUnique({ where: { code: code.trim().toUpperCase() } })
  if (existing) {
    return NextResponse.json({ error: 'Code already exists' }, { status: 409 })
  }

  const created = await db.discountCode.create({
    data: {
      code: code.trim().toUpperCase(),
      type,
      value: Number(value),
      minAmount: Number(minAmount),
      maxUses: Number(maxUses),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  })
  return NextResponse.json(created, { status: 201 })
}
