import { describe, it, expect, vi, beforeEach } from 'vitest'
import Stripe from 'stripe'

// ── Stripe mock ───────────────────────────────────────────────────────────────
const mockConstructEvent = vi.fn()
const mockSubscriptionsRetrieve = vi.fn()
const mockSessionsList = vi.fn()

vi.mock('@/utils/stripe/server', () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
    checkout: { sessions: { list: mockSessionsList } },
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

// ── Guest provisioning mock ────────────────────────────────────────────────────
const mockProvision = vi.fn()
vi.mock('@/utils/checkout/provision-guest', () => ({
  provisionGuestPurchase: (...args: unknown[]) => mockProvision(...args),
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

  it('ignores (200) a completed session with no app metadata — e.g. a dashboard Payment Link', async () => {
    // Antes devolvía 400, lo que hacía a Stripe reintentar durante días y
    // marcar el endpoint como failing por eventos ajenos a la app (B12).
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: makeSession({ metadata: {} }) },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    // Y no escribe nada en BD.
    expect(mockUpsert).not.toHaveBeenCalled()
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

  it('uses expanded subscription object without calling stripe.subscriptions.retrieve', async () => {
    mockSubscriptionsRetrieve.mockClear()

    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: makeSession({
          metadata: { userId: 'user-1' },
          customer: 'cus_test',
          payment_status: 'paid',
          subscription: {
            id: 'sub_expanded',
            status: 'active',
            items: {
              data: [{
                current_period_start: 1700000000,
                current_period_end: 1702592000,
                price: { id: 'price_x' },
              }],
            },
          } as never,
        }),
      },
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled()
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sub_expanded',
        user_id: 'user-1',
        status: 'active',
        plan_type: 'price_x',
      }),
    )
  })

  it('guest (sin userId, guest=1, paid): provisiona y responde 200', async () => {
    mockProvision.mockResolvedValue({ ok: true, userId: 'guest-user' })
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: makeSession({ metadata: { courseId: 'course-1', guest: '1' }, payment_status: 'paid' }) },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockProvision).toHaveBeenCalled()
  })

  it('guest con provisión fallida por DB: responde 500 (Stripe reintenta)', async () => {
    mockProvision.mockResolvedValue({ ok: false, reason: 'purchase-error:boom' })
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: makeSession({ metadata: { courseId: 'course-1', guest: '1' }, payment_status: 'paid' }) },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(500)
  })

  it('guest: pasa source y fullName desde metadata a provisionGuestPurchase', async () => {
    mockProvision.mockResolvedValue({ ok: true, userId: 'guest-user' })
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: makeSession({ metadata: { courseId: 'c1', guest: '1', source: 'landing', fullName: 'Ana' }, payment_status: 'paid' }) },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockProvision).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ source: 'landing', fullName: 'Ana' }))
  })

  it('logueado: el upsert de course_purchases incluye source:web', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: makeSession({ metadata: { userId: 'u1', courseId: 'c1', source: 'web' }, payment_status: 'paid' }) },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    await POST(makeWebhookRequest())
    const payload = mockUpsert.mock.calls[0][0]
    expect(payload.source).toBe('web')
  })

  it('logueado: course_purchases con error 23505 (UNIQUE constraint) → 200 idempotente', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: makeSession({ metadata: { userId: 'user-1', courseId: 'course-1' }, payment_status: 'paid' }) },
    })
    mockUpsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
  })

  it('logueado: course_purchases con error 40001 (serialization) → 500', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: { object: makeSession({ metadata: { userId: 'user-1', courseId: 'course-1' }, payment_status: 'paid' }) },
    })
    mockUpsert.mockResolvedValueOnce({ error: { code: '40001', message: 'serialization error' } })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(500)
  })
})

describe('POST /api/webhooks/stripe — subscription updates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts subscription status on customer.subscription.updated', async () => {
    const mockSub = {
      id: 'sub_test',
      status: 'active',
      items: {
        data: [{ current_period_start: 1700000000, current_period_end: 1702592000, price: { id: 'price_x' } }],
      },
      metadata: { userId: 'user-1' },
    }
    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.updated',
      data: { object: mockSub },
    })
    mockUpsert.mockResolvedValueOnce({ error: null })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub_test', status: 'active' }),
      expect.objectContaining({ onConflict: 'id' })
    )
  })

  it('marks subscription as canceled on customer.subscription.deleted', async () => {
    const mockSub = {
      id: 'sub_test',
      status: 'canceled',
      items: {
        data: [{ current_period_start: 1700000000, current_period_end: 1702592000, price: { id: 'price_x' } }],
      },
      metadata: {},
    }
    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.deleted',
      data: { object: mockSub },
    })
    mockUpsert.mockResolvedValueOnce({ error: null })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled' }),
      expect.objectContaining({ onConflict: 'id' })
    )
  })

  it('handles customer.subscription.created by upserting the row', async () => {
    mockUpsert.mockClear()
    mockUpsert.mockResolvedValue({ error: null })
    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_new',
          status: 'active',
          items: { data: [{
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            price: { id: 'price_x' },
          }] },
          metadata: { userId: 'user-1' },
        },
      },
    } as never)

    const req = new Request('http://x/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': 'sig' },
      body: '{}',
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sub_new', status: 'active' }),
      expect.objectContaining({ onConflict: 'id' })
    )
  })

  it('subscription.updated upserts (creates if missing) for out-of-order events', async () => {
    mockUpsert.mockClear()
    mockUpsert.mockResolvedValue({ error: null })
    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_late',
          status: 'active',
          items: { data: [{
            current_period_start: 1700000000,
            current_period_end: 1702592000,
            price: { id: 'price_x' },
          }] },
          metadata: { userId: 'user-1' },
        },
      },
    } as never)

    const req = new Request('http://x/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': 'sig' },
      body: '{}',
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalled()
  })
})

describe('POST /api/webhooks/stripe — empty subscription items guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('checkout.session.completed: skips upsert and returns 200 when items is empty', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: makeSession({
          metadata: { userId: 'user-1' },
          subscription: 'sub_test',
          customer: 'cus_test',
          payment_status: 'paid',
        }),
      },
    })
    mockSubscriptionsRetrieve.mockResolvedValueOnce({
      id: 'sub_test',
      status: 'active',
      items: { data: [] },
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    // No subscription upsert should have been called with sentinel 1970 date
    expect(mockUpsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        current_period_start: '1970-01-01T00:00:00.000Z',
      })
    )
    // Specifically: when items is empty we skip the subscription upsert entirely
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('customer.subscription.updated: skips upsert and returns 200 when items is empty', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test',
          status: 'active',
          items: { data: [] },
        },
      },
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('customer.subscription.deleted: skips upsert and returns 200 when items is empty', async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test',
          status: 'canceled',
          items: { data: [] },
        },
      },
    })

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})

// ── Reembolsos y disputas (AUDITORIA-2026-07 A3) ──────────────────────────────
describe('POST /api/webhooks/stripe — charge.refunded / disputes', () => {
  beforeEach(() => vi.clearAllMocks())

  function chainRefundUpdate(rows: Array<{ id: string }>) {
    // update().eq().is().select('id') — devuelve las filas afectadas.
    const select = vi.fn().mockResolvedValue({ data: rows, error: null })
    mockIs.mockReturnValueOnce({ select })
    return select
  }

  it('reembolso TOTAL: marca refunded_at por payment_intent y responde 200', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_1',
      type: 'charge.refunded',
      data: { object: { object: 'charge', amount: 4900, amount_refunded: 4900, payment_intent: 'pi_123' } },
    })
    chainRefundUpdate([{ id: 'p1' }])

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())

    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('course_purchases')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ refunded_at: expect.any(String) }))
    expect(mockUpdateEq).toHaveBeenCalledWith('stripe_payment_intent', 'pi_123')
  })

  it('reembolso PARCIAL: mantiene el acceso (política 2026-07) — no toca la BD', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_2',
      type: 'charge.refunded',
      data: { object: { object: 'charge', amount: 4900, amount_refunded: 1000, payment_intent: 'pi_123' } },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('charge.dispute.created: revoca el acceso', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_3',
      type: 'charge.dispute.created',
      data: { object: { object: 'dispute', status: 'needs_response', payment_intent: 'pi_dis' } },
    })
    chainRefundUpdate([{ id: 'p1' }])

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ refunded_at: expect.any(String) }))
    expect(mockUpdateEq).toHaveBeenCalledWith('stripe_payment_intent', 'pi_dis')
  })

  it('charge.dispute.closed con status=won: restaura el acceso (refunded_at = null)', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_4',
      type: 'charge.dispute.closed',
      data: { object: { object: 'dispute', status: 'won', payment_intent: 'pi_won' } },
    })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ refunded_at: null })
    expect(mockUpdateEq).toHaveBeenCalledWith('stripe_payment_intent', 'pi_won')
  })

  it('compra legacy sin stripe_payment_intent: fallback vía sessions.list y marca por stripe_session_id', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_5',
      type: 'charge.refunded',
      data: { object: { object: 'charge', amount: 4900, amount_refunded: 4900, payment_intent: 'pi_old' } },
    })
    // 1ª update por payment_intent: 0 filas. 2ª update por session_id: 1 fila.
    chainRefundUpdate([])
    mockSessionsList.mockResolvedValueOnce({ data: [{ id: 'cs_legacy' }] })
    chainRefundUpdate([{ id: 'p9' }])

    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(200)
    expect(mockSessionsList).toHaveBeenCalledWith({ payment_intent: 'pi_old', limit: 1 })
    expect(mockUpdateEq).toHaveBeenCalledWith('stripe_session_id', 'cs_legacy')
  })

  it('error de BD al marcar → 500 (Stripe reintenta)', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_6',
      type: 'charge.refunded',
      data: { object: { object: 'charge', amount: 4900, amount_refunded: 4900, payment_intent: 'pi_err' } },
    })
    const select = vi.fn().mockResolvedValue({ data: null, error: { message: 'db down' } })
    mockIs.mockReturnValueOnce({ select })
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const res = await POST(makeWebhookRequest())
    expect(res.status).toBe(500)
  })
})
