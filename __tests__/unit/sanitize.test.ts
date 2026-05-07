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
  it('returns the URL when valid for the given network', () => {
    expect(safeSocialUrl('https://instagram.com/user', 'instagram')).toBe('https://instagram.com/user')
  })

  it('returns null when URL is null', () => {
    expect(safeSocialUrl(null, 'instagram')).toBeNull()
  })

  it('returns null when URL is undefined', () => {
    expect(safeSocialUrl(undefined, 'instagram')).toBeNull()
  })

  it('returns null for http URLs (non-https)', () => {
    expect(safeSocialUrl('http://instagram.com/user', 'instagram')).toBeNull()
  })

  it('returns null for javascript: URLs', () => {
    expect(safeSocialUrl('javascript:void(0)', 'instagram')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(safeSocialUrl('', 'instagram')).toBeNull()
  })
})
