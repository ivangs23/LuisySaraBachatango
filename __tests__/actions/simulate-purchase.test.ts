import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIsDemoMode, mockProvision, mockGetUser, mockRedirect, mockCourseSingle } = vi.hoisted(
  () => ({
    mockIsDemoMode: vi.fn(),
    mockProvision: vi.fn().mockResolvedValue({ ok: true, userId: 'u1' }),
    mockGetUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    mockRedirect: vi.fn((url: string) => { throw new Error('REDIRECT:' + url) }),
    mockCourseSingle: vi.fn().mockResolvedValue({ data: { price_eur: 199 }, error: null }),
  }),
)

vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => mockIsDemoMode() }))

vi.mock('@/utils/checkout/provision-guest', () => ({
  provisionGuestPurchase: (...a: unknown[]) => mockProvision(...a),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))

vi.mock('next/navigation', () => ({ redirect: (u: string) => mockRedirect(u) }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockCourseSingle,
    }),
  }),
}))

import { simulatePurchase } from '@/app/demo-checkout/actions'

function fd(obj: Record<string, string>) {
  const f = new FormData()
  Object.entries(obj).forEach(([k, v]) => f.append(k, v))
  return f
}

beforeEach(() => vi.clearAllMocks())

describe('simulatePurchase', () => {
  it('fuera de demo: redirige a / y NO provisiona', async () => {
    mockIsDemoMode.mockReturnValue(false)
    await expect(simulatePurchase(fd({ courseId: 'c1', email: 'a@b.com' }))).rejects.toThrow('REDIRECT:/')
    expect(mockProvision).not.toHaveBeenCalled()
  })

  it('en demo: provisiona con sesión sintética y redirige a /gracias?demo=1', async () => {
    mockIsDemoMode.mockReturnValue(true)
    await expect(simulatePurchase(fd({ courseId: 'c1', email: 'Buyer@Example.com' }))).rejects.toThrow('REDIRECT:/gracias?demo=1&email=buyer%40example.com')
    const [session] = mockProvision.mock.calls[0]
    expect(session.customer_details.email).toBe('buyer@example.com')
    expect(session.metadata.courseId).toBe('c1')
    expect(String(session.id)).toMatch(/^demo_/)
    const opts = mockProvision.mock.calls[0][2]
    expect(opts).toEqual({ isDemo: true })
  })

  it('en demo, curso no existe/no publicado: redirige a /demo-checkout?...&error=course-not-found y NO provisiona', async () => {
    mockIsDemoMode.mockReturnValue(true)
    mockCourseSingle.mockResolvedValue({ data: null, error: null })
    await expect(simulatePurchase(fd({ courseId: 'c1', email: 'a@b.com' }))).rejects.toThrow('REDIRECT:/demo-checkout?courseId=c1&error=course-not-found')
    expect(mockProvision).not.toHaveBeenCalled()
  })

  it('en demo, courseId vacío: redirige a /demo-checkout?...&error=missing y NO provisiona', async () => {
    mockIsDemoMode.mockReturnValue(true)
    await expect(simulatePurchase(fd({ courseId: '', email: 'a@b.com' }))).rejects.toThrow('REDIRECT:/demo-checkout?courseId=&error=missing')
    expect(mockProvision).not.toHaveBeenCalled()
  })
})
