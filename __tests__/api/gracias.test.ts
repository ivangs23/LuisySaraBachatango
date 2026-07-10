import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/stripe/server', () => {
  const mockRetrieve = vi.fn()
  return {
    stripe: { checkout: { sessions: { retrieve: mockRetrieve } } },
  }
})

import GraciasPage from '@/app/gracias/page'
import { stripe } from '@/utils/stripe/server'

beforeEach(() => vi.clearAllMocks())

describe('/gracias', () => {
  it('sesión pagada: muestra el email del comprador', async () => {
    const mockRetrieve = vi.mocked(stripe.checkout.sessions.retrieve)
    mockRetrieve.mockResolvedValue({ payment_status: 'paid', customer_details: { email: 'buyer@example.com' } } as any)
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
})
