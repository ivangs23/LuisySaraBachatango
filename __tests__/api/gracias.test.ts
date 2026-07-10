import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type Stripe from 'stripe'

vi.mock('@/utils/stripe/server', () => {
  const mockRetrieve = vi.fn()
  return {
    stripe: { checkout: { sessions: { retrieve: mockRetrieve } } },
  }
})

const { mockIsDemoMode, mockGenerateLink, mockGetUser } = vi.hoisted(() => ({
  mockIsDemoMode: vi.fn(() => false),
  mockGenerateLink: vi.fn().mockResolvedValue({ data: { properties: { action_link: 'https://sb/reset-link' } }, error: null }),
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: null } }),
}))
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => mockIsDemoMode() }))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))

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

  describe('modo demo', () => {
    beforeEach(() => {
      mockIsDemoMode.mockReturnValue(true)
    })

    // clearAllMocks() no resetea el valor de retorno de mockReturnValue, así que
    // sin este reset explícito cualquier test añadido después de este bloque
    // heredaría demo=true silenciosamente.
    afterEach(() => {
      mockIsDemoMode.mockReturnValue(false)
    })

    it('en demo con ?demo=1&email y sesión propia coincidente: muestra el link de fijar contraseña, sin llamar a Stripe', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { email: 'buyer@example.com' } } })
      const mockRetrieve = vi.mocked(stripe.checkout.sessions.retrieve)
      const el = await GraciasPage({ searchParams: Promise.resolve({ demo: '1', email: 'buyer@example.com' }) })
      const html = JSON.stringify(el)
      expect(html).toContain('buyer@example.com')
      expect(html).toContain('https://sb/reset-link')
      expect(mockRetrieve).not.toHaveBeenCalled()
    })

    it('en demo con ?demo=1&email de OTRO usuario (sin sesión propia coincidente): NO muestra el link ni llama a generateLink', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } })
      const el = await GraciasPage({ searchParams: Promise.resolve({ demo: '1', email: 'victim@example.com' }) })
      const html = JSON.stringify(el)
      expect(html).toContain('victim@example.com')
      expect(html).not.toContain('https://sb/reset-link')
      expect(mockGenerateLink).not.toHaveBeenCalled()
    })
  })
})
