import { describe, it, expect, vi, beforeEach } from 'vitest'
import Stripe from 'stripe'

// ── Stripe mock ───────────────────────────────────────────────────────────────
const mockConstructEvent = vi.fn()
const mockSubscriptionsRetrieve = vi.fn()

vi.mock('@/utils/stripe/server', () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  },
}))

// ── Supabase admin mock ────────────────────────────────────────────────────────
const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockMaybySingle = vi.fn()

// update().eq().is() chain used in webhook to conditionally update stripe_customer_id
const mockIs = vi.fn().mockResolvedValue({ error: null })
const mockUpdateEq = vi.fn().mockReturnValue({ is: mockIs })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  update: mockUpdate,
  upsert: mockUpsert,
  maybeSingle: mockMaybySingle,
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({ from: mockFrom }),
}))

// ── next/headers mock ─────────────────────────────────────────────────────────
vi.mock('next/headers', () => ({
  headers: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue('test-stripe-signature'),
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeWebhookRequest(body = '{}') {
  return new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': 'test-sig',
    },
    body,
  })
}

function makeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_session',
    object: 'checkout.session',
    payment_status: 'paid',
    metadata: { userId: 'user-1' },
    customer: 'cus_test',
    subscription: null,
    amount_total: 4900,
    ...overrides,
  } as unknown as Stripe.Checkout.Session
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/webhooks/stripe — signature verification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when webhook signature is invalid', async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(400)
  })
})

describe('POST /api/webhooks/stripe — checkout.session.completed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when userId is missing in metadata', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: makeSession({ metadata: {} }) },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(400)
  })

  it('processes a course purchase via idempotent upsert on stripe_session_id', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: makeSession({ metadata: { userId: 'user-1', courseId: 'course-1' } }) },
    })
    mockUpsert.mockResolvedValueOnce({ error: null })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        course_id: 'course-1',
        stripe_session_id: 'cs_test_session',
      }),
      expect.objectContaining({ onConflict: 'stripe_session_id', ignoreDuplicates: true }),
    )
  })
})

describe('POST /api/webhooks/stripe — subscription updates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates subscription status on customer.subscription.updated', async () => {
    const mockSub = {
      id: 'sub_test',
      status: 'active',
      items: {
        data: [{ current_period_start: 1700000000, current_period_end: 1702592000 }],
      },
    }
    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.updated',
      data: { object: mockSub },
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    )
    // .eq() called with the subscription ID
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'sub_test')
  })

  it('marks subscription as canceled on customer.subscription.deleted', async () => {
    const mockSub = {
      id: 'sub_test',
      status: 'canceled',
      items: {
        data: [{ current_period_start: 1700000000, current_period_end: 1702592000 }],
      },
    }
    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.deleted',
      data: { object: mockSub },
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' })
    )
  })
})
