import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

const profileSingle = vi.fn()
const purchaseSingle = vi.fn()
const subSingle = vi.fn()
const courseSingle = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        lte: () => chain,
        gte: () => chain,
        maybeSingle: () => {
          if (table === 'profiles') return profileSingle()
          if (table === 'course_purchases') return purchaseSingle()
          if (table === 'subscriptions') return subSingle()
          return Promise.resolve({ data: null })
        },
        single: () => {
          if (table === 'courses') return courseSingle()
          return Promise.resolve({ data: null })
        },
      }
      return chain
    },
  }),
}))

import { hasCourseAccess } from '@/utils/auth/course-access'

describe('hasCourseAccess', () => {
  beforeEach(() => {
    profileSingle.mockReset()
    purchaseSingle.mockReset()
    subSingle.mockReset()
    courseSingle.mockReset()
  })

  it('returns true when user is admin', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'admin' } })
    courseSingle.mockResolvedValue({ data: { id: 'c1', month: 5, year: 2026 } })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(true)
  })

  it('returns true when user has purchased the course', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'member' } })
    courseSingle.mockResolvedValue({ data: { id: 'c1', month: 5, year: 2026 } })
    purchaseSingle.mockResolvedValue({ data: { id: 'p1' } })
    subSingle.mockResolvedValue({ data: null })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(true)
  })

  it('returns true when active subscription covers the course month', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'member' } })
    courseSingle.mockResolvedValue({ data: { id: 'c1', month: 5, year: 2026 } })
    purchaseSingle.mockResolvedValue({ data: null })
    subSingle.mockResolvedValue({ data: { id: 's1' } })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(true)
  })

  it('returns false when user has no purchase and no covering sub', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'member' } })
    courseSingle.mockResolvedValue({ data: { id: 'c1', month: 5, year: 2026 } })
    purchaseSingle.mockResolvedValue({ data: null })
    subSingle.mockResolvedValue({ data: null })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(false)
  })

  it('returns false when course does not exist', async () => {
    profileSingle.mockResolvedValue({ data: { role: 'member' } })
    courseSingle.mockResolvedValue({ data: null })
    expect(await hasCourseAccess('user-1', 'c1')).toBe(false)
  })
})
