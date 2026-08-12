import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

const eqMock = vi.fn()
const updateMock = vi.fn<(patch: Record<string, unknown>) => { eq: typeof eqMock }>(
  () => ({ eq: eqMock }),
)
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ update: updateMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))
vi.mock('@/utils/auth/client-ip', () => ({ getClientIp: () => '127.0.0.1' }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

import { unsubscribeByToken } from '@/app/unsubscribe/actions'
import { makeUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'

describe('unsubscribeByToken', () => {
  beforeEach(() => {
    updateMock.mockClear()
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
  })

  it('da de baja con un token válido', async () => {
    const token = makeUnsubscribeToken('a@b.com')!
    expect(await unsubscribeByToken('a@b.com', token)).toEqual({ ok: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ unsubscribed_at: expect.any(String) }),
    )
    expect(eqMock).toHaveBeenCalledWith('email', 'a@b.com')
  })

  it('normaliza el email antes de dar de baja', async () => {
    const token = makeUnsubscribeToken('a@b.com')!
    expect(await unsubscribeByToken('  A@B.COM ', token)).toEqual({ ok: true })
    expect(eqMock).toHaveBeenCalledWith('email', 'a@b.com')
  })

  it('rechaza un token inválido sin tocar la BD', async () => {
    expect(await unsubscribeByToken('a@b.com', 'malo')).toEqual({ error: 'invalid' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rechaza el token de otro email', async () => {
    const token = makeUnsubscribeToken('otro@b.com')!
    expect(await unsubscribeByToken('a@b.com', token)).toEqual({ error: 'invalid' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('rechaza un email con formato inválido', async () => {
    expect(await unsubscribeByToken('no-es-email', 'x')).toEqual({ error: 'invalid' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('devuelve server_error si la BD falla', async () => {
    eqMock.mockResolvedValue({ error: { message: 'boom' } })
    const token = makeUnsubscribeToken('a@b.com')!
    expect(await unsubscribeByToken('a@b.com', token)).toEqual({ error: 'server_error' })
  })

  it('devuelve invalid cuando el limitador deniega', async () => {
    const { rateLimit } = await import('@/utils/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 })
    const token = makeUnsubscribeToken('a@b.com')!
    expect(await unsubscribeByToken('a@b.com', token)).toEqual({ error: 'invalid' })
    expect(updateMock).not.toHaveBeenCalled()
  })
})
