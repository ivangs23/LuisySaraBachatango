import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockConstructEvent, mockProvision, mockDelete } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockProvision: vi.fn().mockResolvedValue({ ok: true, userId: 'u1', created: true }),
  mockDelete: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/utils/stripe/server', () => ({ stripe: { webhooks: { constructEvent: mockConstructEvent }, subscriptions: { retrieve: vi.fn() } } }))
vi.mock('@/utils/env/validate-prod', () => ({ assertProdEnv: () => {} }))
vi.mock('@/utils/checkout/provision-registration', () => ({ provisionFromPending: (...a: unknown[]) => mockProvision(...a) }))
vi.mock('@/utils/checkout/provision-guest', () => ({ provisionGuestPurchase: vi.fn().mockResolvedValue({ ok: true, userId: 'g1' }) }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({ get: () => 'sig' }) }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: () => ({ delete: () => ({ eq: (_c: string, id: string) => mockDelete(id) }) }),
  }),
}))

import { POST } from '@/app/api/webhooks/stripe/route'
const post = () => new Request('http://x/api/webhooks/stripe', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig' } })
beforeEach(() => vi.clearAllMocks())

describe('webhook pending-registration branch', () => {
  it('completed + client_reference_id -> provisionFromPending, 200', async () => {
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: 'pend-1', payment_status: 'paid', amount_total: 9900, metadata: {} } } })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(mockProvision).toHaveBeenCalledTimes(1)
  })
  it('provisionFromPending failure (db) -> 500 for retry', async () => {
    mockProvision.mockResolvedValueOnce({ ok: false, reason: 'purchase-error:x' })
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: 'pend-1', payment_status: 'paid', amount_total: 9900, metadata: {} } } })
    const res = await POST(post())
    expect(res.status).toBe(500)
  })
  it('not-paid reason -> 200 (no retry)', async () => {
    mockProvision.mockResolvedValueOnce({ ok: false, reason: 'not-paid' })
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: 'pend-1', payment_status: 'unpaid', amount_total: 9900, metadata: {} } } })
    const res = await POST(post())
    expect(res.status).toBe(200)
  })
  it('checkout.session.expired -> deletes the pending row, 200', async () => {
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.expired', data: { object: { id: 'cs_1', client_reference_id: 'pend-1', metadata: {} } } })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith('pend-1')
  })
  it('legacy guest branch (guest=1, no pendingId) still routes to provisionGuestPurchase', async () => {
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_2', payment_status: 'paid', metadata: { guest: '1', courseId: 'c1' } } } })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(mockProvision).not.toHaveBeenCalled()
  })
})
