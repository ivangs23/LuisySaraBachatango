import { describe, it, expect } from 'vitest'
import { getClientIp } from '@/utils/auth/client-ip'

function mkHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries)
}

describe('getClientIp', () => {
  it('prefers x-vercel-forwarded-for over x-forwarded-for', () => {
    const h = mkHeaders({
      'x-vercel-forwarded-for': '1.1.1.1',
      'x-forwarded-for': '2.2.2.2',
    })
    expect(getClientIp(h)).toBe('1.1.1.1')
  })

  it('falls back to first entry of x-forwarded-for', () => {
    const h = mkHeaders({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' })
    expect(getClientIp(h)).toBe('2.2.2.2')
  })

  it('falls back to x-real-ip', () => {
    const h = mkHeaders({ 'x-real-ip': '4.4.4.4' })
    expect(getClientIp(h)).toBe('4.4.4.4')
  })

  it('returns "anon" if nothing is present', () => {
    expect(getClientIp(mkHeaders({}))).toBe('anon')
  })

  it('trims whitespace from values', () => {
    expect(getClientIp(mkHeaders({ 'x-vercel-forwarded-for': '  5.5.5.5  ' }))).toBe('5.5.5.5')
  })
})
