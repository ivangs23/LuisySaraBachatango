import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * El webhook es quien da acceso al curso a quien acaba de pagar. Lo que se
 * prueba aquí es que reportar a Meta no puede interferir con eso, que no cuenta
 * la venta dos veces y que no manda nada sin consentimiento.
 */

const { mockConstructEvent, mockProvision, mockSend } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockProvision: vi.fn(),
  mockSend: vi.fn(),
}))

vi.mock('@/utils/stripe/server', () => ({
  stripe: { webhooks: { constructEvent: mockConstructEvent }, subscriptions: { retrieve: vi.fn() } },
}))
vi.mock('@/utils/env/validate-prod', () => ({ assertProdEnv: () => {} }))
vi.mock('@/utils/checkout/provision-registration', () => ({
  provisionFromPending: (...a: unknown[]) => mockProvision(...a),
}))
vi.mock('@/utils/checkout/provision-guest', () => ({
  provisionGuestPurchase: vi.fn().mockResolvedValue({ ok: true, userId: 'g1' }),
}))
vi.mock('@/utils/analytics/meta-capi', () => ({
  sendPurchaseToMeta: (...a: unknown[]) => mockSend(...a),
}))
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => false }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({ get: () => 'sig' }) }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: () => ({ delete: () => ({ eq: () => ({ error: null }) }) }),
  }),
}))

import { POST } from '@/app/api/webhooks/stripe/route'

const post = () =>
  new Request('http://x/api/webhooks/stripe', {
    method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig' },
  })

/** Sesión de Checkout como la que crea la landing, con su atribución. */
function sesion(metadata: Record<string, string> = { fb_consent: '1', fbp: 'fb.1.1.p', fbc: 'fb.1.2.c', client_ip: '1.2.3.4', client_ua: 'UA' }) {
  return {
    id: 'cs_live_123',
    client_reference_id: 'pend-1',
    payment_status: 'paid',
    amount_total: 11900,
    currency: 'eur',
    customer_details: { email: 'ana@ejemplo.com', name: 'Ana Pérez' },
    metadata,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockProvision.mockResolvedValue({ ok: true, userId: 'u1', created: true, genuineInsert: true })
  mockSend.mockResolvedValue({ sent: true })
  mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: sesion() } })
})

describe('webhook → API de conversiones de Meta', () => {
  it('reporta la compra con el id de la sesión como event_id', async () => {
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledTimes(1)
    const [input] = mockSend.mock.calls[0]
    // Mismo event_id que manda el píxel desde /gracias: así Meta deduplica.
    expect(input.eventId).toBe('cs_live_123')
    expect(input.value).toBe(119)
    expect(input.currency).toBe('EUR')
    expect(input.contentName).toBe('Curso Bachatango')
    expect(input.email).toBe('ana@ejemplo.com')
    expect(input.fullName).toBe('Ana Pérez')
  })

  it('arrastra la atribución guardada en metadata al crear la sesión', async () => {
    await POST(post())
    const [input] = mockSend.mock.calls[0]
    expect(input.attribution).toEqual({
      fbp: 'fb.1.1.p', fbc: 'fb.1.2.c', ip: '1.2.3.4', ua: 'UA', marketingConsent: true,
    })
  })

  it('una entrega repetida de Stripe NO vuelve a reportar la compra', async () => {
    // Segunda entrega del mismo evento: el alta ya no es genuina.
    mockProvision.mockResolvedValue({ ok: true, userId: 'u1', created: false, genuineInsert: false })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('si el aprovisionamiento falla no se reporta nada', async () => {
    mockProvision.mockResolvedValue({ ok: false, reason: 'purchase-error:x' })
    await POST(post())
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('pasa el consentimiento denegado tal cual; decidir es cosa del módulo', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed', data: { object: sesion({ fb_consent: '0' }) },
    })
    await POST(post())
    expect(mockSend.mock.calls[0][0].attribution.marketingConsent).toBe(false)
  })
})

describe('webhook → Meta nunca puede romper la entrega del curso', () => {
  it('un fallo de Meta no cambia el 200 ni el alta', async () => {
    mockSend.mockResolvedValue({ sent: false, reason: 'http-error' })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(mockProvision).toHaveBeenCalledTimes(1)
  })

  it('una EXCEPCIÓN de Meta tampoco: el comprador no se entera', async () => {
    mockSend.mockRejectedValue(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(post())
    expect(res.status).toBe(200)
  })
})
