# Task 13 — JWT Middleware (Protect Dashboard Routes)

**Phase:** 3 — Dashboard  
**Goal:** Next.js middleware that redirects unauthenticated requests from `/` and all dashboard pages to `/login`.

**Files created:**
- `src/middleware.ts`

---

- [ ] **Step 1: Write `src/middleware.ts`**

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/webhook', '/api/health', '/widget.js']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const token = request.cookies.get('zesto_session')?.value
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const session = verifyToken(token)
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Verify middleware protects routes**

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000` in an incognito browser window (no cookies). Expected: redirects to `/login?from=/`.

Open `http://localhost:3000/api/health`. Expected: responds normally (public route).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add JWT middleware to protect dashboard routes"
```
