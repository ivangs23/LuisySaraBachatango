import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockAssignmentSingle, mockUpsert, mockHasAccess } = vi.hoisted(() => ({
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
  mockAssignmentSingle: vi.fn().mockResolvedValue({ data: { lesson_id: 'l1', lessons: { course_id: 'c1' } } }),
  mockUpsert: vi.fn().mockResolvedValue({ error: null }),
  mockHasAccess: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: (t: string) => t === 'assignments'
      ? { select: () => ({ eq: () => ({ single: mockAssignmentSingle }) }) }
      : { upsert: mockUpsert },
  }),
}))
vi.mock('@/utils/auth/course-access', () => ({ hasCourseAccess: (...a: unknown[]) => mockHasAccess(...a) }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT:' + u) } }))

import { submitAssignment } from '@/app/courses/actions'
beforeEach(() => vi.clearAllMocks())

describe('submitAssignment fileUrl validation', () => {
  it('rejects a javascript: fileUrl (no DB write)', async () => {
    const res = await submitAssignment('a1', 'texto', "javascript:alert(document.cookie)")
    expect(res).toEqual({ error: 'invalid_file' })
    expect(mockUpsert).not.toHaveBeenCalled()
  })
  it('rejects a non-https http: fileUrl', async () => {
    const res = await submitAssignment('a1', 'texto', 'http://evil/x')
    expect(res).toEqual({ error: 'invalid_file' })
    expect(mockUpsert).not.toHaveBeenCalled()
  })
  it('accepts null fileUrl (text-only submission)', async () => {
    const res = await submitAssignment('a1', 'texto', null)
    expect(res).toEqual({ success: true })
    expect(mockUpsert.mock.calls[0][0].file_url).toBe(null)
  })
  it('accepts an https fileUrl and stores it', async () => {
    const res = await submitAssignment('a1', '', 'https://storage.example.com/f.pdf')
    expect(res).toEqual({ success: true })
    expect(mockUpsert.mock.calls[0][0].file_url).toBe('https://storage.example.com/f.pdf')
  })
})
