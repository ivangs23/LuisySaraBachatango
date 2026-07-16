import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockGetUser, mockRateLimit, mockHasAccess } = vi.hoisted(() => ({
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
  mockRateLimit: vi.fn().mockResolvedValue({ ok: true }),
  mockHasAccess: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => mockRateLimit(...a),
  rateLimitKey: (p: unknown[]) => p.join(':')
}))

vi.mock('@/utils/auth/course-access', () => ({
  hasCourseAccess: (...a: unknown[]) => mockHasAccess(...a)
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

function makeSupabaseMock() {
  return {
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { course_id: 'c1' }, error: null }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'comment-1' }, error: null }),
        }),
      }),
    }),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('addComment rate limiting', () => {
  beforeEach(async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock() as never)
  })

  it('is rate-limited (returns error, no insert) when the limiter denies', async () => {
    mockRateLimit.mockResolvedValueOnce({ ok: false })
    const { addComment } = await import('@/app/actions/comments')
    const res = await addComment('l1', 'hola')
    expect(res).toEqual(expect.objectContaining({ error: expect.any(String) }))
    expect(mockRateLimit).toHaveBeenCalled()
  })
})
