import { NextRequest, NextResponse } from 'next/server'

const PUBLIC = ['/login']
const ADMIN_PREFIX = '/admin'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  const sessionCookie = req.cookies.get('ip-session')
  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    // MOCK ONLY — btoa/atob is not a signature; replace with JWT verification in production
    const session = JSON.parse(atob(sessionCookie.value))
    if (pathname.startsWith(ADMIN_PREFIX) && session.role !== 'vendor_admin') {
      return NextResponse.redirect(new URL('/cameras', req.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|image/).*)'],
}
