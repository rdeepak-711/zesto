import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PROTECTED = /^\/dashboard/

export function middleware(req: NextRequest) {
  if (!PROTECTED.test(req.nextUrl.pathname)) return NextResponse.next()

  const token = req.cookies.get('zesto_auth')?.value
  if (!token || !verifyToken(token)) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
