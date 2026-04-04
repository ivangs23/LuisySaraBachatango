import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  const { pathname } = request.nextUrl

  if (!user && requiresAuth(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return response
}
