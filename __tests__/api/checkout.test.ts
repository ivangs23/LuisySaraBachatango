import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Test mode mock ────────────────────────────────────────────────────────────
const mockIsTestPurchaseMode = vi.fn().mockResolvedValue(false)
vi.mock('@/utils/demo/test-mode', () => ({ isTestPurchaseMode: () => mockIsTestPurchaseMode() }))

// ── Stripe mock ───────────────────────────────────────────────────────────────
const mockSessionCreate = vi.fn()
const mockCustomerCreate = vi.fn().mockResolvedValue({ id: 'cus_test' })

vi.mock('@/utils/stripe/server', () => ({
  stripe: {
    checkout: { sessions: { create: mockSessionCreate } },
    customers: { create: mockCustomerCreate },
  },
}))

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockCourseData = { title: 'Test Course', price_eur: 49 }
const mockSupabaseFrom = vi.fn()
const mockGetUser = vi.fn()
const mockAdminUpsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockSupabaseFrom,
  }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { stripe_customer_id: null }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { stripe_customer_id: 'cus_test' }, error: null }),
      update: vi.fn().mockReturnThis(),
      upsert: mockAdminUpsert,
    }),
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(body: unknown, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/checkout — authentication', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ priceId: 'price_test' }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/checkout — course purchase validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'u@test.com' } } })
  })

  it('returns 404 when course does not exist', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'nonexistent-course' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when course price is zero', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: { stripe_customer_id: 'cus_test' }, error: null }) // profile
        .mockResolvedValueOnce({ data: { title: 'Course', price_eur: 0 }, error: null }),  // course
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when course price exceeds 10000', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: { stripe_customer_id: 'cus_test' }, error: null })
        .mockResolvedValueOnce({ data: { title: 'Course', price_eur: 10001 }, error: null }),
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when neither priceId nor courseId is provided', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { stripe_customer_id: 'cus_test' }, error: null }),
      update: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/checkout — web only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTestPurchaseMode.mockResolvedValue(false)
  })

  it('anónimo (sin sesión) con courseId → 401 (no guest checkout)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(401)
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })

  it('logueado real: crea sesión Stripe con metadata source:web', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'u@test.com' } } })
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 199, is_published: true }, error: null }),
    })
    mockSessionCreate.mockResolvedValue({ id: 'cs_web', url: 'https://checkout.stripe.com/web' })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(200)
    expect(mockSessionCreate.mock.calls[0][0].metadata).toEqual(expect.objectContaining({ userId: 'user-1', courseId: 'course-1', source: 'web' }))
    expect(mockSessionCreate.mock.calls[0][0].allow_promotion_codes).toBe(true)
  })
})

describe('POST /api/checkout — demo web', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTestPurchaseMode.mockResolvedValue(true)
    mockAdminUpsert.mockResolvedValue({ error: null })
  })

  it('demo web happy: logueado, compra simulada, upsert exitoso → 200 con url', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'u@test.com' } } })
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 49, is_published: true }, error: null }),
    })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('/courses/course-1')
    expect(mockSessionCreate).not.toHaveBeenCalled()
    expect(mockAdminUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        course_id: 'course-1',
        is_demo: true,
        source: 'web',
        amount_paid: 4900,
      }),
      expect.any(Object)
    )
  })

  it('demo web already-owns (23505): upsert falla con código 23505 → 200 idempotente', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'u@test.com' } } })
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 49, is_published: true }, error: null }),
    })
    mockAdminUpsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('/courses/course-1')
  })

  it('demo web DB error (40001): upsert falla con código 40001 → 500', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'u@test.com' } } })
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 49, is_published: true }, error: null }),
    })
    mockAdminUpsert.mockResolvedValue({ error: { code: '40001', message: 'serialization error' } })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Error al simular la compra.')
  })
})
