import { describe, it, expect, vi, beforeEach } from 'vitest'

const H = vi.hoisted(() => ({
  isTest: vi.fn().mockResolvedValue(false),
  readCookie: vi.fn().mockResolvedValue(false),
  provisionPending: vi.fn().mockResolvedValue({ ok: true, userId: 'u1', created: true }),
  sessionCreate: vi.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }),
  courseSingle: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 129 }, error: null }),
  pendingInsert: vi.fn().mockResolvedValue({ data: { id: 'pend-1' }, error: null }),
  pendingInsertPayload: null as Record<string, unknown> | null,
  pendingDelete: vi.fn().mockResolvedValue({ error: null }),
  redirect: vi.fn((u: string) => { throw new Error('REDIRECT:' + u) }),
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
}))
vi.mock('@/utils/demo/test-mode', () => ({ isTestPurchaseMode: () => H.isTest(), readTestCookie: () => H.readCookie() }))
vi.mock('@/utils/checkout/provision-registration', () => ({ provisionFromPending: (...a: unknown[]) => H.provisionPending(...a) }))
vi.mock('@/utils/stripe/server', () => ({ stripe: { checkout: { sessions: { create: H.sessionCreate } } } }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => H.redirect(u) }))
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: () => '' }),
  // back() guarda el re-echo de campos en una cookie flash (PII fuera de la URL).
  cookies: vi.fn().mockResolvedValue({ set: vi.fn() }),
}))
vi.mock('@/utils/rate-limit', () => ({ rateLimit: (...a: unknown[]) => H.rateLimit(...a), rateLimitKey: (p: (string | null | undefined)[]) => p.map(x => x ?? 'anon').join(':') }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: (t: string) => t === 'pending_registrations'
      ? { insert: (payload: Record<string, unknown>) => { H.pendingInsertPayload = payload; return { select: () => ({ single: H.pendingInsert }) } }, delete: () => ({ eq: (_c: string, v: string) => H.pendingDelete(v) }) }
      : { select: () => ({ eq: () => ({ eq: () => ({ single: H.courseSingle }) }) }) },
  }),
}))

import { landingCheckout } from '@/app/curso-bachatango/comprar/actions'
const fd = (o: Record<string, string>) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.append(k, v)); return f }

// Formulario reducido (tareas 2/3): dos campos + tres casillas. Ya no hay
// contraseña, país, ciudad, código postal, fecha de nacimiento, nivel de
// baile ni teléfono.
const valid = {
  courseId: 'c1', fullName: 'Ana', email: 'ana@example.com',
  isAdult: 'on', acceptTerms: 'on', acceptDigitalExecution: 'on',
}
const formularioValido = () => fd(valid)

// Extrae la URL del redirect que lanza el mock de next/navigation, para
// poder seguir inspeccionando el estado (mocks) tras el catch.
function getRedirectUrl(e: unknown): string {
  if (e instanceof Error && e.message.startsWith('REDIRECT:')) return e.message.slice('REDIRECT:'.length)
  throw e
}

beforeEach(() => { vi.clearAllMocks(); H.isTest.mockResolvedValue(false); H.readCookie.mockResolvedValue(false); H.rateLimit.mockResolvedValue({ ok: true }); H.pendingInsertPayload = null })

describe('landingCheckout (formulario reducido)', () => {
  it('real: inserta el pending sin contraseña y crea la sesión de Stripe con client_reference_id=pendingId', async () => {
    await expect(landingCheckout(formularioValido())).rejects.toThrow('REDIRECT:https://checkout.stripe.com/x')
    const row = H.pendingInsertPayload as Record<string, unknown>
    expect(row.password_hash).toBeNull()
    expect(row).toEqual(expect.objectContaining({
      email: 'ana@example.com', full_name: 'Ana', course_id: 'c1',
      terms_version: '2026-07-14', terms_accepted_at: expect.any(String),
    }))
    const arg = H.sessionCreate.mock.calls[0][0]
    expect(arg.client_reference_id).toBe('pend-1')
    expect(arg.metadata).toEqual(expect.objectContaining({ courseId: 'c1', source: 'landing', pendingId: 'pend-1' }))
    expect(arg.customer_email).toBe('ana@example.com')
    expect(JSON.stringify(arg).toLowerCase()).not.toContain('password')
  })

  it('valida ANTES de gastar cupo: una errata no cuenta como intento', async () => {
    const fdInvalido = fd({ ...valid, email: 'no-es-email' })
    await landingCheckout(fdInvalido).catch(getRedirectUrl)
    expect(H.rateLimit).not.toHaveBeenCalled()
    expect(H.pendingInsert).not.toHaveBeenCalled()
  })

  it('no guarda contraseña ni los campos que nadie leía', async () => {
    await landingCheckout(formularioValido()).catch(getRedirectUrl)
    const row = H.pendingInsertPayload as Record<string, unknown>
    expect(row.password_hash).toBeNull()
    for (const c of ['country', 'city', 'postal_code', 'date_of_birth', 'dance_level', 'phone']) {
      expect(row[c]).toBeUndefined()
    }
  })

  it('sigue sellando los consentimientos antes del pago', async () => {
    await landingCheckout(formularioValido()).catch(getRedirectUrl)
    const row = H.pendingInsertPayload as Record<string, unknown>
    expect(row.terms_version).toBeTruthy()
    expect(row.terms_accepted_at).toBeTruthy()
    expect(row.digital_execution_consent_at).toBeTruthy()
  })

  it('error de validación: redirige con ?error=<code> y NUNCA gasta cupo ni inserta', async () => {
    await expect(landingCheckout(fd({ ...valid, acceptTerms: '' }))).rejects.toThrow(/REDIRECT:.*error=terms_required/)
    await expect(landingCheckout(fd({ ...valid, acceptDigitalExecution: '' })))
      .rejects.toThrow(/REDIRECT:.*error=digital_execution_required/)
    expect(H.rateLimit).not.toHaveBeenCalled()
    expect(H.pendingInsert).not.toHaveBeenCalled()
    expect(H.sessionCreate).not.toHaveBeenCalled()
  })

  it('con cupo agotado: redirige error=rate, sin insertar', async () => {
    H.rateLimit.mockResolvedValue({ ok: false, retryAfter: 60 })
    await expect(landingCheckout(formularioValido())).rejects.toThrow(/error=rate/)
    expect(H.pendingInsert).not.toHaveBeenCalled()
  })

  it('demo/test con cookie de admin: aprovisiona inline (isDemo) con una sesión sintética sin contraseña, redirige a /gracias?demo=1', async () => {
    H.isTest.mockResolvedValue(true); H.readCookie.mockResolvedValue(true)
    await expect(landingCheckout(formularioValido())).rejects.toThrow(/REDIRECT:\/gracias\?demo=1/)
    expect(H.sessionCreate).not.toHaveBeenCalled()
    const [synthetic, , opts] = H.provisionPending.mock.calls[0] as [{ client_reference_id: string }, unknown, unknown]
    expect(opts).toEqual({ isDemo: true })
    expect(synthetic.client_reference_id).toBe('pend-1')
    expect(JSON.stringify(synthetic).toLowerCase()).not.toContain('password')
  })

  it('demo sin cookie de admin contra la referencia de producción: rechaza, borra el pending, no aprovisiona', async () => {
    H.isTest.mockResolvedValue(true); H.readCookie.mockResolvedValue(false)
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jytokoxbsykoyifzbjkd.supabase.co'
    try {
      await expect(landingCheckout(formularioValido())).rejects.toThrow(/error=account_creation_failed/)
      expect(H.provisionPending).not.toHaveBeenCalled()
      expect(H.pendingDelete).toHaveBeenCalledWith('pend-1')
    } finally { process.env.NEXT_PUBLIC_SUPABASE_URL = prev }
  })
})
