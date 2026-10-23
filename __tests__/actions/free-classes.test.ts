import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const upsertSelectMock = vi.fn()
const upsertMock = vi.fn<(payload: Record<string, unknown>, opts: Record<string, unknown>) => { select: typeof upsertSelectMock }>(
  () => ({ select: upsertSelectMock }),
)
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ upsert: upsertMock }) }),
}))

const rateLimitMock = vi.fn()
vi.mock('@/utils/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => rateLimitMock(...a),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))
vi.mock('@/utils/auth/client-ip', () => ({ getClientIp: () => '127.0.0.1' }))

let cookieJar: Record<string, string> = {}
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'user-agent': 'Mozilla/5.0' }),
  cookies: async () => ({ get: (n: string) => (n in cookieJar ? { value: cookieJar[n] } : undefined) }),
}))
// `after()` corre al terminar la respuesta; en el test, en el acto.
vi.mock('next/server', () => ({ after: (cb: () => unknown) => { void cb() } }))
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => false }))

const sendEmailMock = vi.fn()
vi.mock('@/utils/email/free-classes', () => ({ sendFreeClassesEmail: (e: string) => sendEmailMock(e) }))

const recordEventMock = vi.fn()
vi.mock('@/utils/analytics/server-event', () => ({
  recordServerEvent: (...a: unknown[]) => recordEventMock(...a),
}))

const sendLeadMock = vi.fn()
vi.mock('@/utils/analytics/meta-capi', () => ({ sendLeadToMeta: (...a: unknown[]) => sendLeadMock(...a) }))

import { requestFreeClasses } from '@/app/actions/free-classes'
import { CONSENT_COOKIE, makeConsent, serializeConsent } from '@/utils/consent/categories'

function fd(values: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(values).forEach(([k, v]) => f.append(k, v))
  return f
}

const OK = { email: 'Ana@Example.com', consent: 'on' }

describe('requestFreeClasses', () => {
  beforeEach(() => {
    cookieJar = {}
    upsertMock.mockClear()
    upsertSelectMock.mockReset().mockResolvedValue({ data: [{ email: 'ana@example.com' }], error: null })
    rateLimitMock.mockReset().mockResolvedValue({ ok: true, retryAfter: 0 })
    sendEmailMock.mockReset().mockResolvedValue(true)
    recordEventMock.mockReset().mockResolvedValue(undefined)
    sendLeadMock.mockReset().mockResolvedValue({ sent: true })
  })

  it('rechaza un email inválido sin tocar la BD', async () => {
    expect(await requestFreeClasses(fd({ email: 'no', consent: 'on' }))).toEqual({ error: 'invalid_email' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('sin la casilla de consentimiento no guarda ni envía nada', async () => {
    expect(await requestFreeClasses(fd({ email: 'ana@example.com' }))).toEqual({ error: 'consent_required' })
    expect(upsertMock).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('respeta el límite de intentos por IP', async () => {
    rateLimitMock.mockResolvedValue({ ok: false, retryAfter: 60 })
    expect(await requestFreeClasses(fd(OK))).toEqual({ error: 'rate_limit' })
    expect(rateLimitMock.mock.calls[0][0]).toBe('127.0.0.1:free-classes')
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('guarda la prueba de consentimiento con origen clase_gratis', async () => {
    await requestFreeClasses(fd(OK))
    const [payload, opts] = upsertMock.mock.calls[0]
    expect(payload).toMatchObject({
      email: 'ana@example.com',
      consent_ip: '127.0.0.1',
      consent_source: 'clase_gratis',
      unsubscribed_at: null,
    })
    expect(typeof payload.consent_at).toBe('string')
    expect(opts).toMatchObject({ onConflict: 'email' })
  })

  // Quien se dio de baja y vuelve a pedir las clases está dando un
  // consentimiento nuevo: el upsert limpia `unsubscribed_at`.
  it('reactiva a quien se había dado de baja', async () => {
    await requestFreeClasses(fd(OK))
    expect(upsertMock.mock.calls[0][0].unsubscribed_at).toBeNull()
  })

  it('manda el primer email y registra el lead', async () => {
    const r = await requestFreeClasses(fd(OK))
    expect(r).toMatchObject({ success: true })
    expect(sendEmailMock).toHaveBeenCalledWith('ana@example.com')
    expect(recordEventMock).toHaveBeenCalledWith('/curso-bachatango/lead', '127.0.0.1', 'Mozilla/5.0')
  })

  it('si el email falla, la suscripción sigue hecha', async () => {
    sendEmailMock.mockResolvedValue(false)
    expect(await requestFreeClasses(fd(OK))).toMatchObject({ success: true })
  })

  it('si la BD falla, error y sin email', async () => {
    upsertSelectMock.mockResolvedValue({ data: null, error: { code: 'x', message: 'boom' } })
    expect(await requestFreeClasses(fd(OK))).toEqual({ error: 'server_error' })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  describe('evento Lead por la API de conversiones', () => {
    it('con consentimiento de marketing, mismo event_id que devuelve al navegador', async () => {
      cookieJar[CONSENT_COOKIE] = serializeConsent(makeConsent(true, true, new Date()))
      const r = await requestFreeClasses(fd(OK))
      if (!('success' in r)) throw new Error('debería ir bien')
      expect(r.eventId).toMatch(/^[0-9a-f-]{36}$/)
      expect(sendLeadMock).toHaveBeenCalledTimes(1)
      expect(sendLeadMock.mock.calls[0][0]).toMatchObject({ eventId: r.eventId, email: 'ana@example.com' })
    })

    it('sin consentimiento de marketing no sale nada hacia Meta', async () => {
      cookieJar[CONSENT_COOKIE] = serializeConsent(makeConsent(true, false, new Date()))
      await requestFreeClasses(fd(OK))
      expect(sendLeadMock).not.toHaveBeenCalled()
    })

    it('sin decisión sobre cookies, tampoco', async () => {
      await requestFreeClasses(fd(OK))
      expect(sendLeadMock).not.toHaveBeenCalled()
    })
  })
})
