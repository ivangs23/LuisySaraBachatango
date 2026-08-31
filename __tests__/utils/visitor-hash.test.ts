import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

import { dailyVisitorHash, isBot } from '@/utils/analytics/visitor-hash'

const OLD = process.env.LANDING_ANALYTICS_SECRET
const DAY_1 = new Date('2026-08-13T10:00:00Z')
const DAY_1_LATE = new Date('2026-08-13T23:59:00Z')
const DAY_2 = new Date('2026-08-14T00:01:00Z')

describe('dailyVisitorHash', () => {
  beforeEach(() => { process.env.LANDING_ANALYTICS_SECRET = 'test-secret' })
  afterEach(() => { process.env.LANDING_ANALYTICS_SECRET = OLD })

  it('es estable dentro del mismo día', () => {
    const a = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)
    const b = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1_LATE)
    expect(a).toBe(b)
  })

  it('cambia al día siguiente: no hay seguimiento entre días', () => {
    const a = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)
    const b = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_2)
    expect(a).not.toBe(b)
  })

  it('distingue visitantes distintos', () => {
    const a = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)
    const b = dailyVisitorHash('5.6.7.8', 'Mozilla/5.0', DAY_1)
    const c = dailyVisitorHash('1.2.3.4', 'Otro/1.0', DAY_1)
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('no filtra la IP ni el user-agent en la salida', () => {
    const h = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)!
    expect(h).not.toContain('1.2.3.4')
    expect(h).not.toContain('Mozilla')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('fail-closed sin secreto configurado', () => {
    delete process.env.LANDING_ANALYTICS_SECRET
    expect(dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)).toBeNull()
  })

  it('cambiar el secreto cambia los hashes', () => {
    const a = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)
    process.env.LANDING_ANALYTICS_SECRET = 'otro'
    expect(dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)).not.toBe(a)
  })
})

describe('isBot', () => {
  it('detecta rastreadores habituales', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0)',
      'facebookexternalhit/1.1',
      'curl/8.4.0',
      'python-requests/2.31.0',
      'Chrome-Lighthouse',
      'public-surface-monitor',
    ]) expect(isBot(ua), ua).toBe(true)
  })

  it('deja pasar navegadores reales', () => {
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36')).toBe(false)
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(false)
  })

  it('trata la ausencia de user-agent como bot', () => {
    expect(isBot(null)).toBe(true)
    expect(isBot('')).toBe(true)
  })
})
