import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const { variantId } = await params
  const body = await req.json()
  const updated = await db.menuItemVariant.update({ where: { id: variantId }, data: body })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const { variantId } = await params
  await db.menuItemVariant.delete({ where: { id: variantId } })
  return new NextResponse(null, { status: 204 })
}
