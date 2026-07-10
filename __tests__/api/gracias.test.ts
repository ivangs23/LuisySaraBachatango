import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

vi.mock('@/utils/stripe/server', () => {
  const mockRetrieve = vi.fn()
  return {
    stripe: { checkout: { sessions: { retrieve: mockRetrieve } } },
  }
})

const { mockIsDemoMode, mockGenerateLink } = vi.hoisted(() => ({
  mockIsDemoMode: vi.fn(() => false),
  mockGenerateLink: vi.fn().mockResolvedValue({ data: { properties: { action_link: 'https://sb/reset-link' } }, error: null }),
}))
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => mockIsDemoMode() }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({ auth: { admin: { generateLink: mockGenerateLink } } }),
}))

import GraciasPage from '@/app/gracias/page'
import { stripe } from '@/utils/stripe/server'

beforeEach(() => vi.clearAllMocks())

describe('/gracias', () => {
  it('sesión pagada: muestra el email del comprador', async () => {
    const mockRetrieve = vi.mocked(stripe.checkout.sessions.retrieve)
    mockRetrieve.mockResolvedValue({ payment_status: 'paid', customer_details: { email: 'buyer@example.com' } } as unknown as Stripe.Response<Stripe.Checkout.Session>)
    const el = await GraciasPage({ searchParams: Promise.resolve({ session_id: 'cs_1' }) })
    const html = JSON.stringify(el)
    expect(html).toContain('buyer@example.com')
  })

  it('sin session_id: mensaje neutro, no llama a Stripe', async () => {
    const mockRetrieve = vi.mocked(stripe.checkout.sessions.retrieve)
    const el = await GraciasPage({ searchParams: Promise.resolve({}) })
    expect(mockRetrieve).not.toHaveBeenCalled()
    expect(el).toBeTruthy()
  })

  it('en demo con ?demo=1&email muestra el link de fijar contraseña, sin llamar a Stripe', async () => {
    mockIsDemoMode.mockReturnValue(true)
    const mockRetrieve = vi.mocked(stripe.checkout.sessions.retrieve)
    const el = await GraciasPage({ searchParams: Promise.resolve({ demo: '1', email: 'buyer@example.com' }) })
    const html = JSON.stringify(el)
    expect(html).toContain('buyer@example.com')
    expect(html).toContain('https://sb/reset-link')
    expect(mockRetrieve).not.toHaveBeenCalled()
  })
})
