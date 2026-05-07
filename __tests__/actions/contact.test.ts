import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ insert: insertMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))

vi.mock('@/utils/auth/client-ip', () => ({
  getClientIp: () => '127.0.0.1',
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

import { submitContact } from '@/app/actions/contact'

function fd(values: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(values).forEach(([k, v]) => f.append(k, v))
  return f
}

describe('submitContact', () => {
  beforeEach(() => insertMock.mockClear())

  it('rejects empty name', async () => {
    const result = await submitContact(fd({ email: 'a@b.c', message: 'longenough message' }))
    expect(result).toEqual({ error: 'name_required' })
  })

  it('rejects invalid email', async () => {
    const result = await submitContact(fd({ name: 'Ana', email: 'bad', message: 'longenough message' }))
    expect(result).toEqual({ error: 'invalid_email' })
  })

  it('rejects too-short message', async () => {
    const result = await submitContact(fd({ name: 'Ana', email: 'a@b.c', message: 'short' }))
    expect(result).toEqual({ error: 'message_too_short' })
  })

  it('inserts on valid input', async () => {
    insertMock.mockResolvedValue({ error: null })
    const result = await submitContact(fd({
      name: 'Ana', email: 'a@b.c', message: 'longenough message of work'
    }))
    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ana',
      email: 'a@b.c',
      message: 'longenough message of work',
    }))
  })

  it('returns server_error on db failure', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    const result = await submitContact(fd({
      name: 'Ana', email: 'a@b.c', message: 'longenough message of work'
    }))
    expect(result).toEqual({ error: 'server_error' })
  })

  it('returns rate_limit when rate limiter denies', async () => {
    const { rateLimit } = await import('@/utils/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 })
    const result = await submitContact(fd({ name: 'Ana', email: 'a@b.c', message: 'longenough message' }))
    expect(result).toEqual({ error: 'rate_limit' })
  })
})
