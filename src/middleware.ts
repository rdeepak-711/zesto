import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PROTECTED = /^\/dashboard/

export async function middleware(req: NextRequest) {
  if (!PROTECTED.test(req.nextUrl.pathname)) return NextResponse.next()

  const token = req.cookies.get('zesto_auth')?.value
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
