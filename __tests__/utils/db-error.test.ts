import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

import { dbErrorMessage } from '@/utils/errors/db-error'

describe('dbErrorMessage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns a generic message for any DB error', () => {
    const result = dbErrorMessage('addComment', { code: '23505', message: 'duplicate key value violates unique constraint "comments_pkey"' })
    expect(result).toBe('server_error')
  })

  it('logs the original error to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    dbErrorMessage('addComment', { code: '23505', message: 'detail' })
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('addComment'), expect.objectContaining({ code: '23505' }))
  })

  it('handles non-Error inputs', () => {
    expect(dbErrorMessage('x', null)).toBe('server_error')
    expect(dbErrorMessage('x', undefined)).toBe('server_error')
    expect(dbErrorMessage('x', 'just a string')).toBe('server_error')
  })
})
