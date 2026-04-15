import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockCreateSignedUrl = vi.fn()

// createClient always returns a client object; individual methods are reset per test
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: { from: vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) },
  })),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRequest(lessonId: string, courseId?: string) {
  const url = courseId
    ? `http://localhost:3000/api/video/${lessonId}?courseId=${courseId}`
    : `http://localhost:3000/api/video/${lessonId}`
  return new Request(url)
}

function makeChain(terminalOverrides: Record<string, unknown> = {}) {
  const self: Record<string, unknown> = {}
  ;['select', 'eq', 'in', 'lte', 'gte'].forEach(m => { self[m] = vi.fn(() => self) })
  Object.assign(self, terminalOverrides)
  return self
}

const mockLesson = { video_url: 'storage://courses/lesson-1/video.mp4', course_id: 'course-1' }

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('GET /api/video/[lessonId] — parameter validation', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeChain({
      single: vi.fn().mockResolvedValue({ data: mockLesson, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }))
  })

  it('returns 400 when courseId query param is missing', async () => {
    const { GET } = await import('@/app/api/video/[lessonId]/route')
    const res = await GET(makeRequest('lesson-1'), {
      params: Promise.resolve({ lessonId: 'lesson-1' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/video/[lessonId] — authentication', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    mockFrom.mockReturnValue(makeChain({
      single: vi.fn().mockResolvedValue({ data: mockLesson, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }))

    const { GET } = await import('@/app/api/video/[lessonId]/route')
    const res = await GET(makeRequest('lesson-1', 'course-1'), {
      params: Promise.resolve({ lessonId: 'lesson-1' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/video/[lessonId] — lesson lookup', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns 404 when lesson does not exist in this course', async () => {
    mockFrom.mockReturnValue(makeChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }))

    const { GET } = await import('@/app/api/video/[lessonId]/route')
    const res = await GET(makeRequest('bad-lesson', 'course-1'), {
      params: Promise.resolve({ lessonId: 'bad-lesson' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when user has no purchase and no subscription', async () => {
    mockFrom.mockReturnValue(makeChain({
      single: vi.fn()
        .mockResolvedValueOnce({ data: mockLesson, error: null })           // lesson
        .mockResolvedValueOnce({ data: { role: 'member' }, error: null })   // profile
        .mockResolvedValueOnce({ data: { month: 11, year: 2024 }, error: null }), // course
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })  // no purchase
        .mockResolvedValueOnce({ data: null, error: null }), // no subscription
    }))

    const { GET } = await import('@/app/api/video/[lessonId]/route')
    const res = await GET(makeRequest('lesson-1', 'course-1'), {
      params: Promise.resolve({ lessonId: 'lesson-1' }),
    })
    expect(res.status).toBe(403)
  })
})
