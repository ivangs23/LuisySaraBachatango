import { describe, it, expect, vi, beforeEach } from 'vitest'
const { mockGetUser, mockLessonSingle, mockHasAccess } = vi.hoisted(() => ({
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
  mockLessonSingle: vi.fn(),
  mockHasAccess: vi.fn(),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockLessonSingle }) }) }) }) }) }) }),
  }),
}))
vi.mock('@/utils/auth/course-access', () => ({ hasCourseAccess: (...a: unknown[]) => mockHasAccess(...a) }))
import { GET } from '@/app/api/lessons/next/route'
beforeEach(() => vi.clearAllMocks())

describe('GET /api/lessons/next', () => {
  it('401 when logged out', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect((await GET()).status).toBe(401)
  })
  it('returns null when the lesson course is not accessible', async () => {
    mockLessonSingle.mockResolvedValue({ data: { id: 'l1', course_id: 'c1', is_free: false }, error: null })
    mockHasAccess.mockResolvedValue(false)
    const res = await GET(); expect(await res.json()).toBe(null)
  })
  it('returns the lesson when accessible', async () => {
    mockLessonSingle.mockResolvedValue({ data: { id: 'l1', course_id: 'c1', is_free: false, title: 'X' }, error: null })
    mockHasAccess.mockResolvedValue(true)
    const res = await GET(); expect((await res.json()).id).toBe('l1')
  })
  it('returns a free lesson without an access check', async () => {
    mockLessonSingle.mockResolvedValue({ data: { id: 'l2', course_id: 'c1', is_free: true, title: 'Y' }, error: null })
    mockHasAccess.mockResolvedValue(false)
    const res = await GET(); expect((await res.json()).id).toBe('l2')
  })
})
