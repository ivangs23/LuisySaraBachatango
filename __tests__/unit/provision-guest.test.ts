import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { provisionGuestPurchase } from '@/utils/checkout/provision-guest'

// Chainable mock de un query de supabase-js
function makeAdmin(opts: {
  existingId?: string | null
  reFetchId?: string | null
  inviteUser?: { id: string } | null
  inviteError?: { message: string } | null
  purchaseError?: { message: string; code?: string } | null
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
  } as unknown as SupabaseClient & { _spies: { from: typeof from; upsert: typeof upsert; inviteUserByEmail: typeof inviteUserByEmail } }
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
    const res = await provisionGuestPurchase(makeSession({ customer_details: null }), admin)
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

  it('compra repetida (unique_violation en user_id+course_id): se trata como éxito idempotente', async () => {
    const admin = makeAdmin({ existingId: 'existing-user', purchaseError: { code: '23505', message: 'dup' } })
    const res = await provisionGuestPurchase(makeSession(), admin)
    expect(res).toEqual({ ok: true, userId: 'existing-user' })
  })

  it('demo (isDemo:true), email nuevo: invita con data.is_demo y marca la compra is_demo', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: { id: 'new-user' } })
    const res = await provisionGuestPurchase(makeSession(), admin, { isDemo: true })
    expect(res).toEqual({ ok: true, userId: 'new-user' })
    expect(admin._spies.inviteUserByEmail).toHaveBeenCalledWith(
      'buyer@example.com',
      expect.objectContaining({ data: { is_demo: true } }),
    )
    const [payload] = admin._spies.upsert.mock.calls[0]
    expect(payload.is_demo).toBe(true)
  })

  it('real (sin opts): invita SIN data.is_demo y el upsert NO incluye is_demo', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: { id: 'new-user' } })
    await provisionGuestPurchase(makeSession(), admin)
    const inviteArg = admin._spies.inviteUserByEmail.mock.calls[0][1]
    expect(inviteArg.data).toBeUndefined()
    const [payload] = admin._spies.upsert.mock.calls[0]
    expect('is_demo' in payload).toBe(false)
  })

  it('con source y fullName: upsert incluye source y el invite pasa data.full_name', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: { id: 'new-user' } })
    await provisionGuestPurchase(makeSession(), admin, { source: 'landing', fullName: 'María López' })
    const inviteArg = admin._spies.inviteUserByEmail.mock.calls[0][1]
    expect(inviteArg.data).toEqual(expect.objectContaining({ full_name: 'María López' }))
    const [payload] = admin._spies.upsert.mock.calls[0]
    expect(payload.source).toBe('landing')
  })

  it('sin source: el upsert NO incluye la clave source', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: { id: 'new-user' } })
    await provisionGuestPurchase(makeSession(), admin)
    const [payload] = admin._spies.upsert.mock.calls[0]
    expect('source' in payload).toBe(false)
  })
})
