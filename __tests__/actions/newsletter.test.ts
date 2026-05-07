import { describe, it, expect, vi, beforeEach } from 'vitest'

const upsertMock = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ upsert: upsertMock }) }),
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

import { subscribeNewsletter } from '@/app/actions/newsletter'

function fd(values: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(values).forEach(([k, v]) => f.append(k, v))
  return f
}

describe('subscribeNewsletter', () => {
  beforeEach(() => upsertMock.mockClear())

  it('rejects invalid email', async () => {
    const r = await subscribeNewsletter(fd({ email: 'no' }))
    expect(r).toEqual({ error: 'invalid_email' })
  })

  it('rejects empty email', async () => {
    const r = await subscribeNewsletter(fd({ email: '' }))
    expect(r).toEqual({ error: 'invalid_email' })
  })

  it('upserts valid email and returns success', async () => {
    upsertMock.mockResolvedValue({ error: null })
    const r = await subscribeNewsletter(fd({ email: 'A@B.com' }))
    expect(r).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledWith({ email: 'a@b.com' }, expect.objectContaining({ onConflict: 'email' }))
  })

  it('normalises email to lowercase', async () => {
    upsertMock.mockResolvedValue({ error: null })
    await subscribeNewsletter(fd({ email: 'UPPER@CASE.COM' }))
    expect(upsertMock).toHaveBeenCalledWith({ email: 'upper@case.com' }, expect.anything())
  })

  it('returns server_error on db failure', async () => {
    upsertMock.mockResolvedValue({ error: { code: '23505', message: 'db error' } })
    const r = await subscribeNewsletter(fd({ email: 'a@b.com' }))
    expect(r).toEqual({ error: 'server_error' })
  })

  it('returns rate_limit when rate limiter denies', async () => {
    const { rateLimit } = await import('@/utils/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 })
    const r = await subscribeNewsletter(fd({ email: 'a@b.com' }))
    expect(r).toEqual({ error: 'rate_limit' })
  })
})
