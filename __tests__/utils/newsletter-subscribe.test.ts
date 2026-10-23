import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const maybeSingleMock = vi.fn()
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
const upsertSelectMock = vi.fn()
const upsertMock = vi.fn<(payload: Record<string, unknown>, opts: Record<string, unknown>) => { select: typeof upsertSelectMock }>(
  () => ({ select: upsertSelectMock }),
)
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: eqMock }), upsert: upsertMock }),
  }),
}))

import { upsertSubscriber } from '@/utils/newsletter/subscribe'

/** Fila que ya existe en newsletter_subscribers para ese email. */
function existe(fila: { consent_source: string; unsubscribed_at: string | null } | null) {
  maybeSingleMock.mockResolvedValue({ data: fila, error: null })
}

const payload = () => upsertMock.mock.calls[0][0]

describe('upsertSubscriber', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-24T09:00:00Z'))
    maybeSingleMock.mockReset()
    eqMock.mockClear()
    upsertMock.mockClear()
    upsertSelectMock.mockReset().mockResolvedValue({ data: [{ email: 'ana@example.com' }], error: null })
  })

  it('un email nuevo queda con el origen del formulario', async () => {
    existe(null)
    expect(await upsertSubscriber({ email: 'ana@example.com', ip: '1.2.3.4', source: 'newsletter_form' })).toBe(true)
    expect(payload()).toMatchObject({ email: 'ana@example.com', consent_source: 'newsletter_form', unsubscribed_at: null })
  })

  // Si la newsletter de la home pisara el origen, quien entró por la clase
  // gratis saldría de la secuencia de nutrición sin haberlo pedido.
  it('la newsletter nunca sobrescribe consent_source = clase_gratis', async () => {
    existe({ consent_source: 'clase_gratis', unsubscribed_at: null })
    await upsertSubscriber({ email: 'ana@example.com', ip: '1.2.3.4', source: 'newsletter_form' })
    expect(eqMock).toHaveBeenCalledWith('email', 'ana@example.com')
    expect(payload().consent_source).toBe('clase_gratis')
  })

  it('reactiva a quien se dio de baja, con un consentimiento nuevo y sin perder el origen', async () => {
    existe({ consent_source: 'clase_gratis', unsubscribed_at: '2026-10-20T10:00:00Z' })
    await upsertSubscriber({ email: 'ana@example.com', ip: '1.2.3.4', source: 'newsletter_form' })
    expect(payload()).toMatchObject({
      unsubscribed_at: null,
      consent_at: '2026-10-24T09:00:00.000Z',
      consent_ip: '1.2.3.4',
      consent_source: 'clase_gratis',
    })
  })

  it('una baja de la newsletter que vuelve por la newsletter también se reactiva', async () => {
    existe({ consent_source: 'newsletter_form', unsubscribed_at: '2026-10-20T10:00:00Z' })
    await upsertSubscriber({ email: 'ana@example.com', ip: '1.2.3.4', source: 'newsletter_form' })
    expect(payload()).toMatchObject({ unsubscribed_at: null, consent_source: 'newsletter_form' })
  })

  // Al revés sí: pedir las clases es el consentimiento para la secuencia.
  it('pedir las clases convierte a un suscriptor de la newsletter en clase_gratis', async () => {
    existe({ consent_source: 'newsletter_form', unsubscribed_at: null })
    await upsertSubscriber({ email: 'ana@example.com', ip: '1.2.3.4', source: 'clase_gratis' })
    expect(payload().consent_source).toBe('clase_gratis')
  })

  it('si no puede leer el origen actual, no escribe a ciegas', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { code: 'x', message: 'boom' } })
    expect(await upsertSubscriber({ email: 'ana@example.com', ip: '1.2.3.4', source: 'newsletter_form' })).toBe(false)
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
