import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  sendPurchase: vi.fn(),
  sendFreeClasses: vi.fn(),
  generateLink: vi.fn(),
  getUserById: vi.fn(),
  filas: {} as Record<string, unknown>,
}))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath, updateTag: h.updateTag, unstable_cache: (fn: unknown) => fn }))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => h.requireAdmin() }))
vi.mock('@/utils/email/purchase-confirmation', () => ({
  sendPurchaseConfirmation: (...a: unknown[]) => h.sendPurchase(...a),
  PURCHASE_CONFIRMATION_SUBJECT: 'x',
}))
vi.mock('@/utils/email/free-classes', () => ({ sendFreeClassesEmail: (...a: unknown[]) => h.sendFreeClasses(...a) }))
// Cada tabla devuelve una sola fila fija (`h.filas`), sea cual sea el filtro.
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({
    from: (tabla: string) => {
      const b = {
        select: () => b, eq: () => b,
        maybeSingle: async () => ({ data: h.filas[tabla] ?? null, error: null }),
      }
      return b
    },
    auth: { admin: { generateLink: h.generateLink, getUserById: h.getUserById } },
  }),
}))

import { resendPurchaseEmail, resendFreeClassesEmail } from '@/app/admin/correos/actions'

const COMPRA = '7f1771bf-e3fd-43ba-bea5-e001502e849e'

beforeEach(() => {
  vi.clearAllMocks()
  h.requireAdmin.mockResolvedValue({ id: 'admin' })
  h.sendPurchase.mockResolvedValue(true)
  h.sendFreeClasses.mockResolvedValue(true)
  h.generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'tok123' } }, error: null })
  h.getUserById.mockResolvedValue({ data: { user: { last_sign_in_at: null } }, error: null })
  h.filas = {
    course_purchases: { user_id: 'u1', is_demo: false, refunded_at: null },
    profiles: { email: 'Jose@Example.com', full_name: 'Jose Juan' },
    newsletter_subscribers: { consent_source: 'clase_gratis', unsubscribed_at: null },
  }
})

describe('resendPurchaseEmail', () => {
  it('sin admin no hace nada', async () => {
    h.requireAdmin.mockRejectedValue(new Error('forbidden'))
    await expect(resendPurchaseEmail(COMPRA)).rejects.toThrow()
    expect(h.sendPurchase).not.toHaveBeenCalled()
  })

  it('rechaza un id que no es de compra', async () => {
    expect(await resendPurchaseEmail('1 or 1=1')).toEqual({ ok: false, error: 'Compra no válida.' })
    expect(h.sendPurchase).not.toHaveBeenCalled()
  })

  it('quien no ha entrado nunca recibe un enlace nuevo para crear su contraseña', async () => {
    expect(await resendPurchaseEmail(COMPRA)).toEqual({ ok: true })
    expect(h.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'jose@example.com' })
    expect(h.sendPurchase).toHaveBeenCalledWith({
      email: 'jose@example.com',
      fullName: 'Jose Juan',
      existingAccount: false,
      setPasswordUrl: expect.stringContaining('/auth/confirm?token_hash=tok123&type=recovery&next=/reset-password'),
      accountHasNoPassword: true,
    })
  })

  it('quien ya ha entrado recibe el de «entra con tu contraseña», sin enlace', async () => {
    h.getUserById.mockResolvedValue({ data: { user: { last_sign_in_at: '2026-10-26T19:53:05Z' } }, error: null })
    await resendPurchaseEmail(COMPRA)
    expect(h.generateLink).not.toHaveBeenCalled()
    expect(h.sendPurchase).toHaveBeenCalledWith(expect.objectContaining({ existingAccount: true, setPasswordUrl: undefined }))
  })

  it('si no se puede generar el enlace, lo manda igual con la salida de «olvidé mi contraseña»', async () => {
    h.generateLink.mockResolvedValue({ data: null, error: { message: 'rate limit' } })
    expect(await resendPurchaseEmail(COMPRA)).toEqual({ ok: true })
    expect(h.sendPurchase).toHaveBeenCalledWith(expect.objectContaining({ setPasswordUrl: undefined, accountHasNoPassword: true }))
  })

  it('refresca el panel y el aviso del menú al momento', async () => {
    await resendPurchaseEmail(COMPRA)
    expect(h.updateTag).toHaveBeenCalledWith('admin-email-status')
    expect(h.revalidatePath).toHaveBeenCalledWith('/admin/correos')
  })

  it('si Resend no lo acepta, lo dice y no refresca', async () => {
    h.sendPurchase.mockResolvedValue(false)
    const r = await resendPurchaseEmail(COMPRA)
    expect(r.ok).toBe(false)
    expect(h.updateTag).not.toHaveBeenCalled()
  })

  it('no manda nada a una compra reembolsada', async () => {
    h.filas.course_purchases = { user_id: 'u1', is_demo: false, refunded_at: '2026-10-20T00:00:00Z' }
    expect((await resendPurchaseEmail(COMPRA)).ok).toBe(false)
    expect(h.sendPurchase).not.toHaveBeenCalled()
  })

  it('no manda nada a una compra de prueba', async () => {
    h.filas.course_purchases = { user_id: 'u1', is_demo: true, refunded_at: null }
    expect((await resendPurchaseEmail(COMPRA)).ok).toBe(false)
    expect(h.sendPurchase).not.toHaveBeenCalled()
  })

  it('compra inexistente', async () => {
    delete h.filas.course_purchases
    expect(await resendPurchaseEmail(COMPRA)).toEqual({ ok: false, error: 'No encuentro esa compra.' })
  })
})

describe('resendFreeClassesEmail', () => {
  it('sin admin no hace nada', async () => {
    h.requireAdmin.mockRejectedValue(new Error('forbidden'))
    await expect(resendFreeClassesEmail('eva@example.com')).rejects.toThrow()
    expect(h.sendFreeClasses).not.toHaveBeenCalled()
  })

  it('manda las dos clases a quien se apuntó y refresca', async () => {
    expect(await resendFreeClassesEmail(' Eva@Example.com ')).toEqual({ ok: true })
    expect(h.sendFreeClasses).toHaveBeenCalledWith('eva@example.com')
    expect(h.updateTag).toHaveBeenCalledWith('admin-email-status')
  })

  it('nunca a quien se dio de baja', async () => {
    h.filas.newsletter_subscribers = { consent_source: 'clase_gratis', unsubscribed_at: '2026-10-26T00:00:00Z' }
    expect((await resendFreeClassesEmail('eva@example.com')).ok).toBe(false)
    expect(h.sendFreeClasses).not.toHaveBeenCalled()
  })

  it('nunca a quien no se apuntó desde las clases gratis', async () => {
    h.filas.newsletter_subscribers = { consent_source: 'newsletter_form', unsubscribed_at: null }
    expect((await resendFreeClassesEmail('eva@example.com')).ok).toBe(false)
    expect(h.sendFreeClasses).not.toHaveBeenCalled()
  })

  it('rechaza un email mal formado', async () => {
    expect(await resendFreeClassesEmail('no-es-un-email')).toEqual({ ok: false, error: 'Email no válido.' })
  })

  it('si Resend no lo acepta, lo dice', async () => {
    h.sendFreeClasses.mockResolvedValue(false)
    expect((await resendFreeClassesEmail('eva@example.com')).ok).toBe(false)
  })
})
