import { describe, it, expect, vi, beforeEach } from 'vitest'

const upsertSelectMock = vi.fn()
// Firma tipada para poder inspeccionar `mock.calls[0]` sin castear. Los
// argumentos no se usan en el cuerpo: solo se registran para las aserciones.
const upsertMock = vi.fn<(payload: Record<string, unknown>, opts: Record<string, unknown>) => { select: typeof upsertSelectMock }>(
  () => ({ select: upsertSelectMock }),
)
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ upsert: upsertMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))

vi.mock('@/utils/auth/client-ip', () => ({ getClientIp: () => '127.0.0.1' }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const sendWelcomeMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/utils/email/newsletter-welcome', () => ({
  sendNewsletterWelcome: (o: unknown) => sendWelcomeMock(o),
}))

import { subscribeNewsletter } from '@/app/actions/newsletter'

function fd(values: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(values).forEach(([k, v]) => f.append(k, v))
  return f
}

describe('subscribeNewsletter', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    upsertSelectMock.mockReset()
    sendWelcomeMock.mockClear()
    sendWelcomeMock.mockResolvedValue(undefined)
    upsertSelectMock.mockResolvedValue({ data: [{ email: 'a@b.com' }], error: null })
  })

  it('rechaza email inválido', async () => {
    expect(await subscribeNewsletter(fd({ email: 'no' }))).toEqual({ error: 'invalid_email' })
  })

  it('rechaza email vacío', async () => {
    expect(await subscribeNewsletter(fd({ email: '' }))).toEqual({ error: 'invalid_email' })
  })

  it('normaliza a minúsculas y guarda prueba de consentimiento', async () => {
    await subscribeNewsletter(fd({ email: 'UPPER@CASE.COM' }))
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'upper@case.com',
        consent_ip: '127.0.0.1',
        consent_source: 'newsletter_form',
        unsubscribed_at: null,
      }),
      expect.objectContaining({ onConflict: 'email' }),
    )
  })

  it('reactiva a quien se había dado de baja', async () => {
    await subscribeNewsletter(fd({ email: 'a@b.com' }))
    const [payload, opts] = upsertMock.mock.calls[0]
    expect(payload.unsubscribed_at).toBeNull()
    expect(opts.ignoreDuplicates).not.toBe(true)
  })

  it('envía el email de bienvenida al suscribirse', async () => {
    await subscribeNewsletter(fd({ email: 'a@b.com' }))
    expect(sendWelcomeMock).toHaveBeenCalledWith({ email: 'a@b.com' })
  })

  it('devuelve server_error si la BD falla y no envía email', async () => {
    upsertSelectMock.mockResolvedValue({ data: null, error: { code: '23505', message: 'db error' } })
    expect(await subscribeNewsletter(fd({ email: 'a@b.com' }))).toEqual({ error: 'server_error' })
    expect(sendWelcomeMock).not.toHaveBeenCalled()
  })

  it('devuelve success aunque el email falle', async () => {
    sendWelcomeMock.mockRejectedValueOnce(new Error('resend down'))
    expect(await subscribeNewsletter(fd({ email: 'a@b.com' }))).toEqual({ success: true })
  })

  it('devuelve rate_limit cuando el limitador deniega', async () => {
    const { rateLimit } = await import('@/utils/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 })
    expect(await subscribeNewsletter(fd({ email: 'a@b.com' }))).toEqual({ error: 'rate_limit' })
  })
})
