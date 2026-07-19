import { describe, it, expect, vi, beforeEach } from 'vitest'

const H = vi.hoisted(() => ({
  isTest: vi.fn().mockResolvedValue(false),
  readCookie: vi.fn().mockResolvedValue(false),
  hash: vi.fn().mockResolvedValue('$2b$12$hash'),
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
vi.mock('@/utils/checkout/password-hash', () => ({ hashPassword: (p: string) => H.hash(p) }))
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
const valid = {
  courseId: 'c1', fullName: 'Ana', email: 'ana@example.com',
  password: 'Bachata2026', repeatPassword: 'Bachata2026', country: 'ES', city: 'Madrid',
  postalCode: '28001', dateOfBirth: '1995-05-20', danceLevel: 'principiante', acceptTerms: 'on',
}
beforeEach(() => { vi.clearAllMocks(); H.isTest.mockResolvedValue(false); H.readCookie.mockResolvedValue(false); H.rateLimit.mockResolvedValue({ ok: true }) })

describe('landingCheckout (full registration)', () => {
  it('real: hashes password, inserts pending, creates Stripe session with client_reference_id=pendingId and NO password fields', async () => {
    await expect(landingCheckout(fd(valid))).rejects.toThrow('REDIRECT:https://checkout.stripe.com/x')
    expect(H.hash).toHaveBeenCalledWith('Bachata2026')
    // The pending row stores the HASHED password (never plaintext) + the
    // snake_case-mapped fields.
    const row = H.pendingInsertPayload as Record<string, unknown>
    expect(row.password_hash).toBe('$2b$12$hash')
    expect(JSON.stringify(row)).not.toContain('Bachata2026')
    expect(row).toEqual(expect.objectContaining({
      email: 'ana@example.com', full_name: 'Ana', country: 'ES', city: 'Madrid',
      postal_code: '28001', date_of_birth: '1995-05-20', dance_level: 'principiante', course_id: 'c1',
      terms_version: '2026-07-14', terms_accepted_at: expect.any(String),
    }))
    const arg = H.sessionCreate.mock.calls[0][0]
    expect(arg.client_reference_id).toBe('pend-1')
    expect(arg.metadata).toEqual(expect.objectContaining({ courseId: 'c1', source: 'landing', pendingId: 'pend-1' }))
    expect(arg.customer_email).toBe('ana@example.com')
    const asStr = JSON.stringify(arg).toLowerCase()
    expect(asStr).not.toContain('bachata2026')
    expect(asStr).not.toContain('password')
    expect(asStr).not.toContain('$2b$')
  })
  it('validation error: redirects with ?error= code and NEVER hashes or inserts', async () => {
    await expect(landingCheckout(fd({ ...valid, acceptTerms: '' }))).rejects.toThrow(/REDIRECT:.*error=terms_not_accepted/)
    expect(H.hash).not.toHaveBeenCalled()
    expect(H.pendingInsert).not.toHaveBeenCalled()
    expect(H.sessionCreate).not.toHaveBeenCalled()
  })
  it('password mismatch: error=password_mismatch', async () => {
    await expect(landingCheckout(fd({ ...valid, repeatPassword: 'Other1234' }))).rejects.toThrow(/error=password_mismatch/)
  })
  it('rate limited: redirects error=rate, no hash/insert', async () => {
    H.rateLimit.mockResolvedValue({ ok: false, retryAfter: 60 })
    await expect(landingCheckout(fd(valid))).rejects.toThrow(/error=rate/)
    expect(H.hash).not.toHaveBeenCalled()
  })
  it('demo/test with admin cookie: provisions inline (isDemo) with a password-free synthetic session, redirects to /gracias?demo=1', async () => {
    H.isTest.mockResolvedValue(true); H.readCookie.mockResolvedValue(true)
    await expect(landingCheckout(fd(valid))).rejects.toThrow(/REDIRECT:\/gracias\?demo=1/)
    expect(H.sessionCreate).not.toHaveBeenCalled()
    const [synthetic, , opts] = H.provisionPending.mock.calls[0] as [{ client_reference_id: string }, unknown, unknown]
    expect(opts).toEqual({ isDemo: true })
    expect(synthetic.client_reference_id).toBe('pend-1')
    const s = JSON.stringify(synthetic).toLowerCase()
    expect(s).not.toContain('bachata2026'); expect(s).not.toContain('password'); expect(s).not.toContain('$2b$')
  })
  it('demo without admin cookie against the prod ref: refuses, deletes pending, no provision', async () => {
    H.isTest.mockResolvedValue(true); H.readCookie.mockResolvedValue(false)
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jytokoxbsykoyifzbjkd.supabase.co'
    try {
      await expect(landingCheckout(fd(valid))).rejects.toThrow(/error=account_creation_failed/)
      expect(H.provisionPending).not.toHaveBeenCalled()
      expect(H.pendingDelete).toHaveBeenCalledWith('pend-1')
    } finally { process.env.NEXT_PUBLIC_SUPABASE_URL = prev }
  })
})
