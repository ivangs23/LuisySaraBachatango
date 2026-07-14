import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

const sendMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/utils/email/purchase-confirmation', () => ({ sendPurchaseConfirmation: (...a: unknown[]) => sendMock(...a) }))

import { provisionFromPending } from '@/utils/checkout/provision-registration'

// Minimal chainable Supabase admin double. Models the exact chains the impl
// uses: profiles.update(cols).eq()  (2-link, awaitable), profiles
// .update({stripe_customer_id}).eq().is()  (3-link), and course_purchases
// .upsert().select('id')  (returns { data, error }).
function makeAdmin(opts: {
  pending?: Record<string, unknown> | null
  profileByEmail?: { id: string } | null
  createUser?: { id?: string; error?: { message: string; status?: number } }
  purchaseInserted?: Array<{ id: string }>          // [] => idempotent duplicate (no email)
  purchaseError?: { code?: string; message?: string }
  profileSequence?: Array<{ id: string } | null>    // successive profiles-by-email lookups (race)
  existingPurchase?: { id: string } | null          // course_purchases row for session.id (orphan check)
} = {}) {
  const calls = { profileColumns: [] as unknown[], customerId: [] as unknown[], purchaseUpsert: [] as unknown[], pendingDelete: [] as string[], createUser: [] as unknown[] }
  const seq = opts.profileSequence
  let seqI = 0
  const nextProfile = () => seq ? (seq[Math.min(seqI++, seq.length - 1)] ?? null) : (opts.profileByEmail ?? null)
  const purchaseInserted = opts.purchaseInserted ?? [{ id: 'purch-1' }]
  const admin = {
    from(table: string) {
      if (table === 'pending_registrations') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.pending ?? null }) }) }),
          delete: () => ({ eq: (_c: string, id: string) => { calls.pendingDelete.push(id); return Promise.resolve({ error: null }) } }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: nextProfile() }) }) }),
          update: (payload: Record<string, unknown>) => {
            const isCustomerId = 'stripe_customer_id' in payload
            if (isCustomerId) calls.customerId.push(payload); else calls.profileColumns.push(payload)
            return { eq: () => isCustomerId ? { is: () => Promise.resolve({ error: null }) } : Promise.resolve({ error: null }) }
          },
        }
      }
      if (table === 'course_purchases') {
        return {
          upsert: (payload: unknown) => { calls.purchaseUpsert.push(payload); return { select: () => Promise.resolve(opts.purchaseError ? { data: null, error: opts.purchaseError } : { data: purchaseInserted, error: null }) } },
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.existingPurchase ?? null }) }) }),
        }
      }
      throw new Error('unexpected table ' + table)
    },
    auth: { admin: { createUser: async (attrs: unknown) => {
      calls.createUser.push(attrs)
      if (opts.createUser?.error) return { data: { user: null }, error: opts.createUser.error }
      return { data: { user: { id: opts.createUser?.id ?? 'new-user' } }, error: null }
    } } },
    __calls: calls,
  }
  return admin as unknown as import('@supabase/supabase-js').SupabaseClient & { __calls: typeof calls }
}

const PENDING = {
  id: 'pend-1', email: 'ana@example.com', full_name: 'Ana', password_hash: '$2b$12$abc',
  country: 'ES', city: 'Madrid', postal_code: '28001', date_of_birth: '1995-05-20', phone: '+34600', marketing_consent: true,
  dance_level: 'principiante', course_id: 'course-1', amount_expected: 12900,
}
const session = (over: Partial<Stripe.Checkout.Session> = {}) => ({
  id: 'cs_1', client_reference_id: 'pend-1', payment_status: 'paid', amount_total: 9900,
  customer: 'cus_1', metadata: {}, ...over,
} as unknown as Stripe.Checkout.Session)

beforeEach(() => vi.clearAllMocks())

describe('provisionFromPending', () => {
  it('new buyer: creates user (password_hash), updates enumerated profile cols, records purchase, deletes pending, emails (new)', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: null, createUser: { id: 'u-new' } })
    const res = await provisionFromPending(session(), admin)
    expect(res).toEqual({ ok: true, userId: 'u-new', created: true })
    expect(admin.__calls.createUser[0]).toEqual(expect.objectContaining({ email: 'ana@example.com', password_hash: '$2b$12$abc', email_confirm: true, user_metadata: { full_name: 'Ana' } }))
    // enumerated columns bucket only — never password_hash, never stripe_customer_id
    expect(admin.__calls.profileColumns[0]).toEqual(expect.objectContaining({ country: 'ES', city: 'Madrid', postal_code: '28001', date_of_birth: '1995-05-20', phone: '+34600', marketing_consent: true, dance_level: 'principiante' }))
    expect(admin.__calls.profileColumns[0]).not.toHaveProperty('password_hash')
    expect(admin.__calls.customerId[0]).toEqual({ stripe_customer_id: 'cus_1' })
    expect(admin.__calls.purchaseUpsert[0]).toEqual(expect.objectContaining({ user_id: 'u-new', course_id: 'course-1', stripe_session_id: 'cs_1', amount_paid: 9900, source: 'landing' }))
    expect(admin.__calls.purchaseUpsert[0]).not.toHaveProperty('is_demo')
    expect(admin.__calls.pendingDelete).toEqual(['pend-1'])
    expect(sendMock).toHaveBeenCalledWith({ email: 'ana@example.com', fullName: 'Ana', existingAccount: false })
  })
  it('existing account: records purchase, NEVER creates user or writes enumerated profile cols/password; emails (existing)', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: { id: 'u-old' } })
    const res = await provisionFromPending(session(), admin)
    expect(res).toEqual({ ok: true, userId: 'u-old', created: false })
    expect(admin.__calls.createUser).toEqual([])
    expect(admin.__calls.profileColumns).toEqual([]) // no enumerated-column write for existing user
    expect(admin.__calls.purchaseUpsert[0]).toEqual(expect.objectContaining({ user_id: 'u-old' }))
    expect(admin.__calls.pendingDelete).toEqual(['pend-1'])
    expect(sendMock).toHaveBeenCalledWith({ email: 'ana@example.com', fullName: 'Ana', existingAccount: true })
  })
  it('isDemo: marks user_metadata.is_demo and purchase.is_demo', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: null, createUser: { id: 'u-new' } })
    await provisionFromPending(session(), admin, { isDemo: true })
    expect((admin.__calls.createUser[0] as { user_metadata: Record<string, unknown> }).user_metadata).toEqual(expect.objectContaining({ is_demo: true }))
    expect(admin.__calls.purchaseUpsert[0]).toEqual(expect.objectContaining({ is_demo: true }))
  })
  it('duplicate delivery (empty insert) -> no second email', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: { id: 'u-old' }, purchaseInserted: [] })
    const res = await provisionFromPending(session(), admin)
    expect(res.ok).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
    expect(admin.__calls.pendingDelete).toEqual(['pend-1'])
  })
  it('23505 (already owns course via other session) -> idempotent ok, refund-candidate log, NO email', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = makeAdmin({ pending: PENDING, profileByEmail: { id: 'u-old' }, purchaseError: { code: '23505', message: 'dup' } })
    const res = await provisionFromPending(session(), admin)
    expect(res).toEqual({ ok: true, userId: 'u-old', created: false })
    expect(sendMock).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('double-charge candidate'), 'cs_1', 'u-old', 'course-1')
    expect(admin.__calls.pendingDelete).toEqual(['pend-1'])
  })
  it('non-23505 purchase error -> ok:false, pending NOT deleted (retryable)', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: { id: 'u-old' }, purchaseError: { code: '55000', message: 'boom' } })
    const res = await provisionFromPending(session(), admin)
    expect(res.ok).toBe(false)
    expect(admin.__calls.pendingDelete).toEqual([])
  })
  it('not paid -> no provision', async () => {
    const admin = makeAdmin({ pending: PENDING })
    expect(await provisionFromPending(session({ payment_status: 'unpaid' }), admin)).toEqual({ ok: false, reason: 'not-paid' })
    expect(admin.__calls.createUser).toEqual([])
  })
  it('missing amount_total -> no provision', async () => {
    const admin = makeAdmin({ pending: PENDING })
    expect(await provisionFromPending(session({ amount_total: null }), admin)).toEqual({ ok: false, reason: 'bad-amount' })
  })
  it('coupon (amount_total 9900 < expected 12900) still provisions', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: null, createUser: { id: 'u-new' } })
    expect((await provisionFromPending(session({ amount_total: 9900 }), admin)).ok).toBe(true)
  })
  it('pending not found (retry after success) -> idempotent ok, no re-provision', async () => {
    const admin = makeAdmin({ pending: null })
    expect(await provisionFromPending(session(), admin)).toEqual({ ok: true, userId: '', created: false })
    expect(admin.__calls.createUser).toEqual([])
  })
  it('pending not found + NO purchase for session (orphaned paid) -> logs reconciliation candidate', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = makeAdmin({ pending: null, existingPurchase: null })
    const res = await provisionFromPending(session({ customer_details: { email: 'x@y.com' } as Stripe.Checkout.Session.CustomerDetails }), admin)
    expect(res).toEqual({ ok: true, userId: '', created: false })
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('orphaned-paid-session'), 'cs_1', 'x@y.com')
  })
  it('pending not found + purchase EXISTS (retry after success) -> silent, no reconciliation log', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = makeAdmin({ pending: null, existingPurchase: { id: 'p1' } })
    const res = await provisionFromPending(session(), admin)
    expect(res).toEqual({ ok: true, userId: '', created: false })
    expect(errSpy).not.toHaveBeenCalledWith(expect.stringContaining('orphaned-paid-session'), expect.anything(), expect.anything())
  })
  it('createUser already-exists race -> re-SELECT profile and continue (no 500), treated as existing', async () => {
    const admin = makeAdmin({ pending: PENDING, profileSequence: [null, { id: 'u-raced' }], createUser: { error: { message: 'already been registered', status: 422 } } })
    const res = await provisionFromPending(session(), admin)
    expect(res).toEqual({ ok: true, userId: 'u-raced', created: false })
    expect(admin.__calls.profileColumns).toEqual([]) // raced -> treated as existing, no enumerated write
  })
})
