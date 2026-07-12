import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIsDemoMode, mockProvision, mockSessionCreate, mockCourseSingle, mockRedirect, mockRateLimit } = vi.hoisted(() => ({
  mockIsDemoMode: vi.fn(),
  mockProvision: vi.fn().mockResolvedValue({ ok: true, userId: 'u1' }),
  mockSessionCreate: vi.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }),
  mockCourseSingle: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 199 }, error: null }),
  mockRedirect: vi.fn((u: string) => { throw new Error('REDIRECT:' + u) }),
  mockRateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
}))
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => mockIsDemoMode() }))
vi.mock('@/utils/checkout/provision-guest', () => ({ provisionGuestPurchase: (...a: unknown[]) => mockProvision(...a) }))
vi.mock('@/utils/stripe/server', () => ({ stripe: { checkout: { sessions: { create: mockSessionCreate } } } }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => mockRedirect(u) }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({ get: () => '' }) }))
vi.mock('@/utils/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => mockRateLimit(...a),
  rateLimitKey: (parts: (string | null | undefined)[]) => parts.map(p => p ?? 'anon').join(':'),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockCourseSingle }),
  }),
}))

import { landingCheckout } from '@/app/curso-bachatango/comprar/actions'

function fd(o: Record<string, string>) { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.append(k, v)); return f }
beforeEach(() => vi.clearAllMocks())

describe('landingCheckout', () => {
  it('demo: provisiona sintético con source landing + fullName y va a /gracias?demo=1', async () => {
    mockIsDemoMode.mockReturnValue(true)
    await expect(landingCheckout(fd({ courseId: 'c1', email: 'Buyer@Example.com', fullName: 'Ana' })))
      .rejects.toThrow('REDIRECT:/gracias?demo=1&email=buyer%40example.com')
    const [session, , opts] = mockProvision.mock.calls[0]
    expect(session.customer_details.email).toBe('buyer@example.com')
    expect(session.metadata).toEqual(expect.objectContaining({ courseId: 'c1', source: 'landing', fullName: 'Ana' }))
    expect(opts).toEqual({ isDemo: true, source: 'landing', fullName: 'Ana' })
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })

  it('real: crea sesión Stripe con customer_email + metadata y redirige a Stripe', async () => {
    mockIsDemoMode.mockReturnValue(false)
    await expect(landingCheckout(fd({ courseId: 'c1', email: 'buyer@example.com', fullName: 'Ana' })))
      .rejects.toThrow('REDIRECT:https://checkout.stripe.com/x')
    const arg = mockSessionCreate.mock.calls[0][0]
    expect(arg.customer_email).toBe('buyer@example.com')
    expect(arg.metadata).toEqual(expect.objectContaining({ courseId: 'c1', guest: '1', source: 'landing', fullName: 'Ana' }))
    expect(arg.allow_promotion_codes).toBe(true)
    expect(mockProvision).not.toHaveBeenCalled()
  })

  it('sin email o nombre: redirige de vuelta con error, sin provisionar ni Stripe', async () => {
    mockIsDemoMode.mockReturnValue(false)
    await expect(landingCheckout(fd({ courseId: 'c1', email: '', fullName: '' })))
      .rejects.toThrow(/REDIRECT:\/curso-bachatango\/comprar/)
    expect(mockProvision).not.toHaveBeenCalled()
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })

  it('rate limited: redirige a error=rate sin provisionar ni llamar a Stripe', async () => {
    mockIsDemoMode.mockReturnValue(false)
    mockRateLimit.mockResolvedValueOnce({ ok: false, retryAfter: 60 })
    await expect(landingCheckout(fd({ courseId: 'c1', email: 'buyer@example.com', fullName: 'Ana' })))
      .rejects.toThrow('REDIRECT:/curso-bachatango/comprar?error=rate')
    expect(mockProvision).not.toHaveBeenCalled()
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })

  it('real: error de Stripe redirige con error=stripe', async () => {
    mockIsDemoMode.mockReturnValue(false)
    mockSessionCreate.mockRejectedValueOnce(new Error('stripe down'))
    await expect(landingCheckout(fd({ courseId: 'c1', email: 'buyer@example.com', fullName: 'Ana' })))
      .rejects.toThrow('REDIRECT:/curso-bachatango/comprar?courseId=c1&error=stripe')
    expect(mockProvision).not.toHaveBeenCalled()
  })
})
