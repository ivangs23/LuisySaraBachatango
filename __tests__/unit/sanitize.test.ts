import { describe, it, expect } from 'vitest'
import { sanitizeUrl, safeSocialUrl } from '@/utils/sanitize'

describe('sanitizeUrl', () => {
  it('returns a valid https URL as-is', () => {
    expect(sanitizeUrl('https://instagram.com/user')).toBe('https://instagram.com/user')
  })

  it('trims whitespace before validating', () => {
    expect(sanitizeUrl('  https://instagram.com/user  ')).toBe('https://instagram.com/user')
  })

  it('returns null for http URLs', () => {
    expect(sanitizeUrl('http://instagram.com/user')).toBeNull()
  })

  it('returns null for javascript: protocol (XSS vector)', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
  })

  it('returns null for data: protocol', () => {
    expect(sanitizeUrl('data:text/html,<h1>XSS</h1>')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(sanitizeUrl('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(sanitizeUrl('   ')).toBeNull()
  })

  it('returns null for null', () => {
    expect(sanitizeUrl(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(sanitizeUrl(undefined)).toBeNull()
  })

  it('returns null for a malformed URL', () => {
    expect(sanitizeUrl('not-a-url')).toBeNull()
  })

  it('allows https URLs with query params and paths', () => {
    const url = 'https://www.youtube.com/@channel?ref=test'
    expect(sanitizeUrl(url)).toBe(url)
  })

  it('allows https URLs with ports', () => {
    expect(sanitizeUrl('https://example.com:8443/path')).toBe('https://example.com:8443/path')
  })
})

describe('safeSocialUrl', () => {
  const fallback = 'https://instagram.com/default'

  it('returns the URL when valid', () => {
    expect(safeSocialUrl('https://instagram.com/user', fallback)).toBe('https://instagram.com/user')
  })

  it('returns the fallback when URL is null', () => {
    expect(safeSocialUrl(null, fallback)).toBe(fallback)
  })

  it('returns the fallback when URL is undefined', () => {
    expect(safeSocialUrl(undefined, fallback)).toBe(fallback)
  })

  it('returns the fallback for http URLs', () => {
    expect(safeSocialUrl('http://instagram.com/user', fallback)).toBe(fallback)
  })

  it('returns the fallback for javascript: URLs', () => {
    expect(safeSocialUrl('javascript:void(0)', fallback)).toBe(fallback)
  })

  it('returns the fallback for empty string', () => {
    expect(safeSocialUrl('', fallback)).toBe(fallback)
  })
})
