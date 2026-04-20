// In-memory rate limiter — works per serverless instance.
// For distributed rate limiting across all Vercel instances, replace with @vercel/kv or Upstash Redis.

const store = new Map<string, { count: number; resetAt: number }>()

// Purge expired entries every minute to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of store) {
    if (now > value.resetAt) store.delete(key)
  }
}, 60_000)

/**
 * Returns true if the request is allowed, false if the rate limit is exceeded.
 * @param key      Unique identifier (e.g. IP address + route)
 * @param limit    Max requests allowed per window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}
