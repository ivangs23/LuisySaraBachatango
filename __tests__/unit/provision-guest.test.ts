import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import { provisionGuestPurchase } from '@/utils/checkout/provision-guest'

// Chainable mock de un query de supabase-js
function makeAdmin(opts: {
  existingId?: string | null
  reFetchId?: string | null
  inviteUser?: { id: string } | null
  inviteError?: { message: string } | null
  purchaseError?: { message: string } | null
}) {
  const maybeSingle = vi.fn()
  // primera búsqueda por email
  maybeSingle.mockResolvedValueOnce({ data: opts.existingId ? { id: opts.existingId } : null, error: null })
  // re-lookup tras invite (si se usa)
  maybeSingle.mockResolvedValueOnce({ data: opts.reFetchId ? { id: opts.reFetchId } : null, error: null })

  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const upsert = vi.fn().mockResolvedValue({ error: opts.purchaseError ?? null })
  const is = vi.fn().mockResolvedValue({ error: null })
  const updateEq = vi.fn().mockReturnValue({ is })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const from = vi.fn().mockReturnValue({ select, upsert, update })

  const inviteUserByEmail = vi.fn().mockResolvedValue({
    data: { user: opts.inviteUser ?? null },
    error: opts.inviteError ?? null,
  })

  return {
    from,
    auth: { admin: { inviteUserByEmail } },
    _spies: { from, upsert, inviteUserByEmail },
  } as any
}

function makeSession(over: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_guest_1',
    amount_total: 19900,
    customer: 'cus_guest',
    customer_details: { email: 'Buyer@Example.com' },
    metadata: { courseId: 'course-1', guest: '1' },
    ...over,
  } as unknown as Stripe.Checkout.Session
}

beforeEach(() => vi.clearAllMocks())

describe('provisionGuestPurchase', () => {
  it('email nuevo: invita y registra compra con el id devuelto', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: { id: 'new-user' } })
    const res = await provisionGuestPurchase(makeSession(), admin)
    expect(res).toEqual({ ok: true, userId: 'new-user' })
    expect(admin._spies.inviteUserByEmail).toHaveBeenCalledWith('buyer@example.com', expect.objectContaining({ redirectTo: expect.stringContaining('/auth/callback?next=/reset-password') }))
    expect(admin._spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'new-user', course_id: 'course-1', stripe_session_id: 'cs_guest_1', amount_paid: 19900 }),
      expect.objectContaining({ onConflict: 'stripe_session_id' }),
    )
  })

  it('email existente: NO invita, registra compra con id existente', async () => {
    const admin = makeAdmin({ existingId: 'existing-user' })
    const res = await provisionGuestPurchase(makeSession(), admin)
    expect(res).toEqual({ ok: true, userId: 'existing-user' })
    expect(admin._spies.inviteUserByEmail).not.toHaveBeenCalled()
    expect(admin._spies.upsert).toHaveBeenCalled()
  })

  it('sin email: devuelve ok:false no-email, sin invitar ni insertar', async () => {
    const admin = makeAdmin({})
    const res = await provisionGuestPurchase(makeSession({ customer_details: { email: null } as any }), admin)
    expect(res).toEqual({ ok: false, reason: 'no-email' })
    expect(admin._spies.upsert).not.toHaveBeenCalled()
  })

  it('carrera "already registered": re-lookup encuentra el user y registra compra', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: null, inviteError: { message: 'already been registered' }, reFetchId: 'raced-user' })
    const res = await provisionGuestPurchase(makeSession(), admin)
    expect(res).toEqual({ ok: true, userId: 'raced-user' })
    expect(admin._spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'raced-user' }),
      expect.anything(),
    )
  })
})
