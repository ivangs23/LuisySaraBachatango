import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Demo mode mock ────────────────────────────────────────────────────────────
const mockIsDemoMode = vi.fn(() => false)
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => mockIsDemoMode() }))

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

describe('POST /api/checkout — guest (sin sesión)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 199, is_published: true }, error: null }),
    })
    mockSessionCreate.mockResolvedValue({ id: 'cs_guest', url: 'https://checkout.stripe.com/guest' })
  })

  it('sin sesión pero con courseId: crea sesión guest y devuelve url', async () => {
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://checkout.stripe.com/guest')
    const arg = mockSessionCreate.mock.calls[0][0]
    expect(arg.customer).toBeUndefined()
    expect(arg.metadata).toEqual({ courseId: 'course-1', guest: '1' })
    expect(arg.success_url).toContain('/gracias?session_id=')
    expect(mockCustomerCreate).not.toHaveBeenCalled()
  })

  it('sin sesión y sin courseId: sigue devolviendo 401', async () => {
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ priceId: 'price_test' }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/checkout — modo demo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(true)
    mockGetUser.mockResolvedValue({ data: { user: null } })
  })

  // clearAllMocks() no resetea el valor de retorno de mockReturnValue, así que
  // sin este reset explícito cualquier test añadido después de este bloque
  // heredaría demo=true silenciosamente.
  afterEach(() => {
    mockIsDemoMode.mockReturnValue(false)
  })

  it('en demo, con courseId, devuelve la url de /demo-checkout sin llamar a Stripe', async () => {
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('/demo-checkout?courseId=course-1')
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })
})
