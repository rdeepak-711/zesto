import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/', req.url))
  res.cookies.set({ name: 'zesto_auth', value: '', maxAge: 0, path: '/' })
  return res
}
