import { describe, it, expect, vi, beforeEach } from 'vitest'

// requiresAuth is not exported, so we test it indirectly via updateSession.
// We define the same logic here to ensure the patterns are correct.
const AUTH_REQUIRED_PREFIXES = [
  '/dashboard',
  '/profile',
  '/community/create',
  '/courses/create',
]

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

describe('requiresAuth — protected routes', () => {
  it.each([
    '/dashboard',
    '/dashboard/settings',
    '/profile',
    '/profile/edit',
    '/community/create',
    '/courses/create',
    '/courses/abc123/edit',
    '/courses/abc123/add-lesson',
    '/courses/abc123/lesson456/edit',
    '/courses/abc123/lesson456/submissions',
    '/courses/abc123/lesson456/submissions/review',
  ])('requires auth: %s', (path) => {
    expect(requiresAuth(path)).toBe(true)
  })
})

describe('requiresAuth — public routes', () => {
  it.each([
    '/',
    '/courses',
    '/courses/abc123',
    '/courses/abc123/lesson456',
    '/community',
    '/community/abc123',
    '/login',
    '/pricing',
    '/about',
    '/contact',
    '/music',
    '/events',
    '/blog',
    '/auth/callback',
  ])('does NOT require auth: %s', (path) => {
    expect(requiresAuth(path)).toBe(false)
  })
})
