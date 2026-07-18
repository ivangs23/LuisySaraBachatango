import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared mutable state that the vi.mock factories close over.
// These must be plain objects (not vi.fn() variables) to survive hoisting.
const supabaseMock = {
  getUser: vi.fn(),
}

const stripeMock = {
  retrieve: vi.fn(),
}

const adminMock = {
  upsert: vi.fn(),
}

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: (...args: unknown[]) => supabaseMock.getUser(...args) },
  }),
}))

// Catch any accidental admin client usage from this action
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ upsert: (...args: unknown[]) => adminMock.upsert(...args) }),
    auth: { admin: { deleteUser: vi.fn() } },
  }),
}))

vi.mock('@/utils/stripe/server', () => ({
  stripe: {
    checkout: {
      sessions: { retrieve: (...args: unknown[]) => stripeMock.retrieve(...args) },
    },
    subscriptions: { retrieve: vi.fn() },
  },
}))

import { verifyStripeSession } from '@/app/profile/actions'

describe('verifyStripeSession', () => {
  beforeEach(() => {
    supabaseMock.getUser.mockReset()
    stripeMock.retrieve.mockReset()
    adminMock.upsert.mockReset()
    supabaseMock.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  })

  it('returns success for a paid session owned by the current user', async () => {
    stripeMock.retrieve.mockResolvedValue({ payment_status: 'paid', metadata: { userId: 'u1' } })
    const result = await verifyStripeSession('cs_test_1')
    expect(result).toEqual({ success: true })
    expect(adminMock.upsert).not.toHaveBeenCalled()
  })

  it('returns failure for unpaid session', async () => {
    stripeMock.retrieve.mockResolvedValue({ payment_status: 'unpaid', metadata: { userId: 'u1' } })
    const result = await verifyStripeSession('cs_test_2')
    expect(result.success).toBe(false)
    expect(adminMock.upsert).not.toHaveBeenCalled()
  })

  it('throws if not authenticated', async () => {
    supabaseMock.getUser.mockResolvedValue({ data: { user: null } })
    await expect(verifyStripeSession('cs_test_3')).rejects.toThrow(/not authenticated/i)
  })

  it('returns generic error on Stripe failure', async () => {
    stripeMock.retrieve.mockRejectedValue(new Error('network'))
    const result = await verifyStripeSession('cs_test_4')
    expect(result.success).toBe(false)
  })

  it('returns failure when the session belongs to a different user (ownership guard)', async () => {
    stripeMock.retrieve.mockResolvedValue({ payment_status: 'paid', metadata: { userId: 'someone-else' } })
    const result = await verifyStripeSession('cs_test_5')
    expect(result.success).toBe(false)
    expect(adminMock.upsert).not.toHaveBeenCalled()
  })

  it('returns failure when the session has no metadata at all', async () => {
    stripeMock.retrieve.mockResolvedValue({ payment_status: 'paid' })
    const result = await verifyStripeSession('cs_test_6')
    expect(result.success).toBe(false)
  })
})
