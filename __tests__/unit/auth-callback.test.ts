import { describe, it, expect } from 'vitest'

// The open-redirect fix extracted as a pure function for isolated testing
function safeNextParam(next: string | null): string {
  if (!next) return '/'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

describe('auth callback — open redirect prevention', () => {
  it('allows safe relative paths', () => {
    expect(safeNextParam('/dashboard')).toBe('/dashboard')
  })

  it('allows paths with query params', () => {
    expect(safeNextParam('/profile?tab=settings')).toBe('/profile?tab=settings')
  })

  it('allows nested paths', () => {
    expect(safeNextParam('/courses/abc/lesson-1')).toBe('/courses/abc/lesson-1')
  })

  it('blocks double-slash open redirect', () => {
    expect(safeNextParam('//evil.com')).toBe('/')
  })

  it('blocks absolute https URL', () => {
    expect(safeNextParam('https://evil.com')).toBe('/')
  })

  it('blocks absolute http URL', () => {
    expect(safeNextParam('http://evil.com/phish')).toBe('/')
  })

  it('blocks protocol-relative URL', () => {
    expect(safeNextParam('//evil.com/steal')).toBe('/')
  })

  it('returns / when next is null', () => {
    expect(safeNextParam(null)).toBe('/')
  })

  it('returns / when next is empty string', () => {
    expect(safeNextParam('')).toBe('/')
  })
})
