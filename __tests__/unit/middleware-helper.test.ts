import { describe, it, expect } from 'vitest'
import {
  AUTH_REQUIRED_PREFIXES,
  AUTH_REQUIRED_PATTERNS,
  requiresAuth,
} from '@/utils/supabase/middleware-helper'

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

describe('exported route tables', () => {
  it('every prefix is itself a protected path', () => {
    for (const prefix of AUTH_REQUIRED_PREFIXES) {
      expect(requiresAuth(prefix)).toBe(true)
    }
  })

  it('patterns cover the admin lesson/course editing routes', () => {
    const samples = [
      '/courses/x/edit',
      '/courses/x/add-lesson',
      '/courses/x/y/edit',
      '/courses/x/y/submissions',
    ]
    for (const path of samples) {
      expect(AUTH_REQUIRED_PATTERNS.some(r => r.test(path))).toBe(true)
    }
  })
})
