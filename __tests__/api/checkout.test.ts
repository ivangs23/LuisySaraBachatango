import { describe, it, expect, vi, beforeEach } from 'vitest'

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
