import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, _resetRateLimitForTest } from '@/utils/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => _resetRateLimitForTest())

  it('allows up to limit and blocks the next call', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('k1', 5, 1000).ok).toBe(true)
    }
    const blocked = rateLimit('k1', 5, 1000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('isolates buckets by key', () => {
    rateLimit('k2', 1, 1000)
    expect(rateLimit('k2', 1, 1000).ok).toBe(false)
    expect(rateLimit('k3', 1, 1000).ok).toBe(true)
  })

  it('resets after window', async () => {
    rateLimit('k4', 1, 50)
    expect(rateLimit('k4', 1, 50).ok).toBe(false)
    await new Promise(r => setTimeout(r, 80))
    expect(rateLimit('k4', 1, 50).ok).toBe(true)
  })
})
