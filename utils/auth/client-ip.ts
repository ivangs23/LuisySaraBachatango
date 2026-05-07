/**
 * Extracts the client IP from request headers, preferring headers set by
 * the Vercel platform (which cannot be spoofed by the client).
 *
 * Order of preference:
 *   1. x-vercel-forwarded-for — Vercel-set, trusted.
 *   2. x-forwarded-for — first entry; reliable on Vercel because the
 *      platform overwrites client-supplied values; less reliable behind
 *      additional proxies.
 *   3. x-real-ip — fallback for some setups.
 *   4. 'anon' — nothing available.
 */
export function getClientIp(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0]?.trim() || 'anon'

  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  const real = headers.get('x-real-ip')
  if (real) return real.trim()

  return 'anon'
}
