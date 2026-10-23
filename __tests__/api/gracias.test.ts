import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// La página importa ahora `provisionFromPending`, marcado `server-only`.
// Se neutraliza igual que en el resto de la suite.
vi.mock('server-only', () => ({}))
import type Stripe from 'stripe'

vi.mock('@/utils/stripe/server', () => {
  const mockRetrieve = vi.fn()
  return {
    stripe: { checkout: { sessions: { retrieve: mockRetrieve } } },
  }
})

const { mockIsTestPurchaseMode, mockGenerateLink, mockGetUser } = vi.hoisted(() => ({
  mockIsTestPurchaseMode: vi.fn().mockResolvedValue(false),
  mockGenerateLink: vi.fn().mockResolvedValue({ data: { properties: { action_link: 'https://sb/reset-link' } }, error: null }),
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: null } }),
}))
vi.mock('@/utils/demo/test-mode', () => ({ isTestPurchaseMode: () => mockIsTestPurchaseMode() }))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({ auth: { admin: { generateLink: mockGenerateLink } } }),
}))

// El píxel de compra es un componente de cliente con su propio test
// (purchase-tracking.test.tsx); aquí solo interesa el texto de la página.
vi.mock('@/app/gracias/PurchaseTracking', () => ({ default: () => null }))

import { renderToStaticMarkup } from 'react-dom/server'
import GraciasPage from '@/app/gracias/page'
import { stripe } from '@/utils/stripe/server'

beforeEach(() => vi.clearAllMocks())

describe('/gracias', () => {
  it('sesión pagada: muestra el email del comprador ENMASCARADO (M7: no ser un oráculo de emails)', async () => {
    const mockRetrieve = vi.mocked(stripe.checkout.sessions.retrieve)
    mockRetrieve.mockResolvedValue({ payment_status: 'paid', customer_details: { email: 'buyer@example.com' } } as unknown as Stripe.Response<Stripe.Checkout.Session>)
    const el = await GraciasPage({ searchParams: Promise.resolve({ session_id: 'cs_1' }) })
    const html = JSON.stringify(el)
    // Un tercero que obtenga el session_id (captura, log) no debe poder leer
    // el email completo del comprador.
    expect(html).not.toContain('buyer@example.com')
    expect(html).toContain('b***@e***.com')
    // El formulario ya no pide contraseña: nadie "la eligió al comprar". Esta
    // es la página que ve el 100% de los compradores nada más pagar (success_url
    // de Stripe), así que la falsedad aquí es la más visible de todas.
    expect(html).not.toMatch(/elegiste al comprar/i)
    // Escapatoria real para quien no reciba el correo (p. ej. cayó en spam):
    // sin contraseña propia, sin este enlace no hay forma de entrar.
    expect(html).toContain('/forgot-password')
  })

  describe('sesión pagada: un solo mensaje', () => {
    // Antes había dos párrafos que decían lo mismo con palabras distintas
    // («para crear tu acceso» y «para crear tu contraseña»). Ahora uno solo,
    // que además dice por dónde empezar, y el enlace de recuperación como
    // plan B.
    async function textoPagada(email: string | null) {
      vi.mocked(stripe.checkout.sessions.retrieve).mockResolvedValue({
        payment_status: 'paid', customer_details: { email },
      } as unknown as Stripe.Response<Stripe.Checkout.Session>)
      const el = await GraciasPage({ searchParams: Promise.resolve({ session_id: 'cs_1' }) })
      return renderToStaticMarkup(el).replace(/<[^>]+>/g, '')
    }

    it('dice a qué email ha ido el correo y por qué lección empezar', async () => {
      expect(await textoPagada('buyer@example.com')).toContain(
        'Te hemos enviado un email a b***@e***.com para crear tu contraseña. Cuando entres, empieza por la lección 1.',
      )
    })

    it('sin email en la sesión, el mismo mensaje sin dirección', async () => {
      expect(await textoPagada(null)).toContain(
        'Te hemos enviado un email para crear tu contraseña. Cuando entres, empieza por la lección 1.',
      )
    })

    it('no repite el aviso del correo', async () => {
      const texto = await textoPagada('buyer@example.com')
      expect(texto.match(/Te hemos enviado/g)).toHaveLength(1)
    })

    it('ofrece «¿Olvidaste tu contraseña?» como plan B', async () => {
      expect(await textoPagada('buyer@example.com')).toContain('¿Olvidaste tu contraseña?')
    })
  })

  it('sin session_id: mensaje neutro, no llama a Stripe', async () => {
    const mockRetrieve = vi.mocked(stripe.checkout.sessions.retrieve)
    const el = await GraciasPage({ searchParams: Promise.resolve({}) })
    expect(mockRetrieve).not.toHaveBeenCalled()
    expect(el).toBeTruthy()
  })

  describe('modo demo', () => {
    beforeEach(() => {
      mockIsTestPurchaseMode.mockResolvedValue(true)
    })

    // clearAllMocks() no resetea el valor de retorno de mockReturnValue, así que
    // sin este reset explícito cualquier test añadido después de este bloque
    // heredaría demo=true silenciosamente.
    afterEach(() => {
      mockIsTestPurchaseMode.mockResolvedValue(false)
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
