import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'

// Routes that require authentication (any logged-in user)
const AUTH_REQUIRED_PREFIXES = [
  '/dashboard',
  '/profile',
  '/community/create',
  '/courses/create',
]

// Route patterns that require authentication (regex)
const AUTH_REQUIRED_PATTERNS = [
  /^\/courses\/[^/]+\/edit$/,
  /^\/courses\/[^/]+\/add-lesson$/,
  /^\/courses\/[^/]+\/[^/]+\/edit$/,
  /^\/courses\/[^/]+\/[^/]+\/submissions/,
]

function requiresAuth(pathname: string): boolean {
  if (AUTH_REQUIRED_PREFIXES.some(p => pathname.startsWith(p))) return true
  if (AUTH_REQUIRED_PATTERNS.some(r => r.test(pathname))) return true
  return false
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Sentry tunnel route: rate-limit by IP and pass through (no auth check).
  if (pathname === '/monitoring') {
    const xff = request.headers.get('x-forwarded-for') ?? ''
    const ip = xff.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'anon'
    const rl = await rateLimit(rateLimitKey([ip, 'monitoring']), 1000, 60_000)
    if (!rl.ok) {
      return new NextResponse(null, {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfter) },
      })
    }
    return NextResponse.next({ request: { headers: request.headers } })
  }

  const isAuthRoute = requiresAuth(pathname)
  const hasSessionCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-'))

  // Public route + no session cookie → skip Supabase entirely.
  if (!isAuthRoute && !hasSessionCookie) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return response
}
