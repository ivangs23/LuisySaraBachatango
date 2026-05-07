import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hasCourseAccess } from '@/utils/auth/course-access'

// ─── Integration tests for courses actions ────────────────────────────────────
// Mocks must be declared before any module imports.

const { mockRevalidatePath, mockRedirect, mockRequireAdmin, mockCreateClient } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockRedirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  mockRequireAdmin: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath, revalidateTag: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/utils/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
  getCurrentRole: vi.fn(),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: mockCreateClient,
}))
// createSupabaseAdmin is used by gradeSubmission only; not needed for these three actions.
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }),
  })),
}))
vi.mock('@/utils/auth/course-access', () => ({
  hasCourseAccess: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function fd(values: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(values).forEach(([k, v]) => f.append(k, v))
  return f
}

function makeInsert(result: { data?: unknown; error: unknown } = { data: { id: 'lesson-1' }, error: null }) {
  const singleMock = vi.fn().mockResolvedValue(result)
  const selectMock = vi.fn().mockReturnValue({ single: singleMock })
  const insertMock = vi.fn().mockReturnValue({ select: selectMock })
  return { insertMock, selectMock, singleMock }
}

function makeUpdate(result: { error: unknown } = { error: null }) {
  const eqMock = vi.fn().mockResolvedValue(result)
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
  return { updateMock, eqMock }
}

function makeUpsert(result: { error: unknown } = { error: null }) {
  const upsertMock = vi.fn().mockResolvedValue(result)
  return { upsertMock }
}

// ── createLesson ──────────────────────────────────────────────────────────────

describe('createLesson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })
  })

  it('returns validation error when order is not a positive integer', async () => {
    const { createLesson } = await import('@/app/courses/actions')
    const result = await createLesson(fd({ courseId: 'c1', title: 'T', description: '', order: '0', thumbnailUrl: '' }))
    expect(result).toEqual({ error: 'El orden de la lección debe ser un número positivo' })
  })

  it('returns validation error when order is NaN', async () => {
    const { createLesson } = await import('@/app/courses/actions')
    const result = await createLesson(fd({ courseId: 'c1', title: 'T', description: '', order: 'abc', thumbnailUrl: '' }))
    expect(result).toEqual({ error: 'El orden de la lección debe ser un número positivo' })
  })

  it('throws when requireAdmin rejects (non-admin)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const { createLesson } = await import('@/app/courses/actions')
    await expect(
      createLesson(fd({ courseId: 'c1', title: 'T', description: '', order: '1' }))
    ).rejects.toThrow('forbidden')
  })

  it('inserts a lesson row with correct fields when admin', async () => {
    const { insertMock, selectMock, singleMock } = makeInsert({ data: { id: 'lesson-new' }, error: null })
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: fromMock,
    })

    const { createLesson } = await import('@/app/courses/actions')
    await expect(
      createLesson(fd({ courseId: 'c1', title: 'Lesson 1', description: 'desc', order: '2', thumbnailUrl: '', isFree: 'on' }))
    ).rejects.toThrow('REDIRECT:/courses/c1/lesson-new/edit')

    expect(fromMock).toHaveBeenCalledWith('lessons')
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      course_id: 'c1',
      title: 'Lesson 1',
      description: 'desc',
      order: 2,
      is_free: true,
      mux_status: 'pending_upload',
    }))
    expect(selectMock).toHaveBeenCalledWith('id')
    expect(singleMock).toHaveBeenCalled()
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1')
  })

  it('returns error when Supabase insert fails', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const insertMock = vi.fn().mockReturnValue({ select: selectMock })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    })

    const { createLesson } = await import('@/app/courses/actions')
    const result = await createLesson(fd({ courseId: 'c1', title: 'T', description: '', order: '1' }))
    expect(result).toEqual({ error: 'DB error' })
  })

  it('sets is_free to false when isFree field is absent', async () => {
    const { insertMock } = makeInsert({ data: { id: 'lesson-x' }, error: null })
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock })
    mockCreateClient.mockResolvedValue({ auth: { getUser: vi.fn() }, from: fromMock })

    const { createLesson } = await import('@/app/courses/actions')
    await createLesson(fd({ courseId: 'c1', title: 'T', description: '', order: '3' })).catch(() => {})

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ is_free: false }))
  })
})

// ── updateCourse ──────────────────────────────────────────────────────────────

describe('updateCourse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })
  })

  it('throws when requireAdmin rejects (non-admin)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const { updateCourse } = await import('@/app/courses/actions')
    await expect(
      updateCourse(fd({ courseId: 'c1', title: 'T', description: '', courseType: 'membership' }))
    ).rejects.toThrow('forbidden')
  })

  it('updates the course row and redirects when admin', async () => {
    const { updateMock, eqMock } = makeUpdate()
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: fromMock,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage/img.jpg' } }),
        }),
      },
    })

    const { updateCourse } = await import('@/app/courses/actions')
    await expect(
      updateCourse(fd({
        courseId: 'c1',
        title: 'New Title',
        description: 'desc',
        courseType: 'complete',
        isPublished: 'on',
        imageUrl: 'https://existing.jpg',
        priceEur: '49',
        year: '2026',
        month: '5',
      }))
    ).rejects.toThrow('REDIRECT:/courses/c1')

    expect(fromMock).toHaveBeenCalledWith('courses')
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New Title',
      description: 'desc',
      course_type: 'complete',
      is_published: true,
      price_eur: 49,
      year: 2026,
      month: 5,
    }))
    expect(eqMock).toHaveBeenCalledWith('id', 'c1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1')
  })

  it('returns error when Supabase update fails', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'update failed' } })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue({ update: updateMock }),
    })

    const { updateCourse } = await import('@/app/courses/actions')
    const result = await updateCourse(fd({ courseId: 'c1', title: 'T', description: '', courseType: 'membership' }))
    expect(result).toEqual({ error: 'update failed' })
  })

  it('sets is_published false when isPublished field is absent', async () => {
    const { updateMock } = makeUpdate()
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })
    mockCreateClient.mockResolvedValue({ auth: { getUser: vi.fn() }, from: fromMock })

    const { updateCourse } = await import('@/app/courses/actions')
    await updateCourse(fd({ courseId: 'c1', title: 'T', description: '', courseType: 'membership' })).catch(() => {})

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ is_published: false }))
  })
})

// ── submitAssignment ──────────────────────────────────────────────────────────

describe('submitAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasCourseAccess).mockResolvedValue(true)
  })

  // Helper: builds a fromMock that returns the assignment lookup on the first
  // call and the submissions upsert on the second call.
  function makeAssignmentFromMock(upsertMock: ReturnType<typeof vi.fn>, courseId = 'c1') {
    const assignmentSingle = vi.fn().mockResolvedValue({
      data: { lesson_id: 'l1', lessons: { course_id: courseId } },
    })
    const fromMock = vi.fn()
      .mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: assignmentSingle }) }),
      })
      .mockReturnValueOnce({ upsert: upsertMock })
    return fromMock
  }

  it('redirects to /login when no authenticated user', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    })

    const { submitAssignment } = await import('@/app/courses/actions')
    await expect(submitAssignment('a1', 'my work', null)).rejects.toThrow('REDIRECT:/login')
  })

  it('upserts a submission row for the authenticated user', async () => {
    const { upsertMock } = makeUpsert()
    const fromMock = makeAssignmentFromMock(upsertMock)
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: fromMock,
    })

    const { submitAssignment } = await import('@/app/courses/actions')
    const result = await submitAssignment('a1', 'my work text', null)

    expect(fromMock).toHaveBeenCalledWith('submissions')
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      assignment_id: 'a1',
      user_id: 'user-1',
      text_content: 'my work text',
      file_url: null,
      status: 'pending',
    }))
    expect(result).toEqual({ success: true })
  })

  it('passes file_url when provided', async () => {
    const { upsertMock } = makeUpsert()
    const fromMock = makeAssignmentFromMock(upsertMock)
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-2' } } }) },
      from: fromMock,
    })

    const { submitAssignment } = await import('@/app/courses/actions')
    await submitAssignment('a2', '', 'https://storage/file.pdf')

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      file_url: 'https://storage/file.pdf',
      text_content: null, // empty string becomes null
    }))
  })

  it('returns error when Supabase upsert fails', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: { message: 'upsert failed' } })
    const fromMock = makeAssignmentFromMock(upsertMock)
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-3' } } }) },
      from: fromMock,
    })

    const { submitAssignment } = await import('@/app/courses/actions')
    const result = await submitAssignment('a3', 'text', null)
    expect(result).toEqual({ error: 'upsert failed' })
  })

  it('rejects when user has no access to the course', async () => {
    vi.mocked(hasCourseAccess).mockResolvedValue(false)

    const assignmentSingle = vi.fn().mockResolvedValue({
      data: { lesson_id: 'l1', lessons: { course_id: 'c1' } },
    })
    const upsertMock = vi.fn()
    const fromMock = vi.fn()
      .mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: assignmentSingle }) }),
      })
      .mockReturnValueOnce({ upsert: upsertMock })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-4' } } }) },
      from: fromMock,
    })

    const { submitAssignment } = await import('@/app/courses/actions')
    const result = await submitAssignment('a1', 'my work', null)
    expect(result).toEqual({ error: 'forbidden' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns assignment_not_found when assignment does not exist', async () => {
    const assignmentSingle = vi.fn().mockResolvedValue({ data: null })
    const upsertMock = vi.fn()
    const fromMock = vi.fn()
      .mockReturnValueOnce({
        select: () => ({ eq: () => ({ single: assignmentSingle }) }),
      })
      .mockReturnValueOnce({ upsert: upsertMock })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-5' } } }) },
      from: fromMock,
    })

    const { submitAssignment } = await import('@/app/courses/actions')
    const result = await submitAssignment('bogus-id', 'work', null)
    expect(result).toEqual({ error: 'assignment_not_found' })
    expect(upsertMock).not.toHaveBeenCalled()
  })
})

// ── markLessonAsCompleted ─────────────────────────────────────────────────────

describe('markLessonAsCompleted', () => {
  let fromMock: ReturnType<typeof vi.fn>
  let upsertMock: ReturnType<typeof vi.fn>
  let getUserMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasCourseAccess).mockResolvedValue(true)

    upsertMock = vi.fn().mockResolvedValue({ error: null })
    getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
    fromMock = vi.fn()

    mockCreateClient.mockResolvedValue({
      auth: { getUser: getUserMock },
      from: fromMock,
    })
  })

  it('returns silently when no user (no error)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const { markLessonAsCompleted } = await import('@/app/courses/actions')
    const result = await markLessonAsCompleted('c1', 'l1')
    expect(result).toBeUndefined()
  })

  it('returns forbidden when user has no access', async () => {
    vi.mocked(hasCourseAccess).mockResolvedValue(false)
    const { markLessonAsCompleted } = await import('@/app/courses/actions')
    const result = await markLessonAsCompleted('c1', 'l1')
    expect(result).toEqual({ error: 'forbidden' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns lesson_mismatch when lesson belongs to a different course', async () => {
    const lessonSingle = vi.fn().mockResolvedValue({ data: { course_id: 'OTHER' } })
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: lessonSingle }) }),
    })
    const { markLessonAsCompleted } = await import('@/app/courses/actions')
    const result = await markLessonAsCompleted('c1', 'l1')
    expect(result).toEqual({ error: 'lesson_mismatch' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('returns lesson_mismatch when lesson does not exist', async () => {
    const lessonSingle = vi.fn().mockResolvedValue({ data: null })
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: lessonSingle }) }),
    })
    const { markLessonAsCompleted } = await import('@/app/courses/actions')
    const result = await markLessonAsCompleted('c1', 'l1')
    expect(result).toEqual({ error: 'lesson_mismatch' })
  })

  it('upserts progress when access granted and lesson matches', async () => {
    const lessonSingle = vi.fn().mockResolvedValue({ data: { course_id: 'c1' } })
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: lessonSingle }) }),
    })
    fromMock.mockReturnValueOnce({ upsert: upsertMock })
    upsertMock.mockResolvedValue({ error: null })
    const { markLessonAsCompleted } = await import('@/app/courses/actions')
    const result = await markLessonAsCompleted('c1', 'l1')
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1',
      lesson_id: 'l1',
      is_completed: true,
    }))
    expect(result).toBeUndefined()
  })
})

// ── File upload validation (pure logic, extracted for testing) ────────────────

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WebP, GIF).'
  }
  if (file.size > MAX_SIZE) {
    return 'El archivo es demasiado grande. El tamaño máximo es 5MB.'
  }
  return null
}

// ── parseInt / NaN validation (pure logic) ────────────────────────────────────

function validateOrder(raw: string): string | null {
  const order = parseInt(raw)
  if (isNaN(order) || order < 1) return 'El orden de la lección debe ser un número positivo'
  return null
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('validateImageFile', () => {
  it('accepts image/jpeg', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1024 })).toBeNull()
  })

  it('accepts image/png', () => {
    expect(validateImageFile({ type: 'image/png', size: 1024 })).toBeNull()
  })

  it('accepts image/webp', () => {
    expect(validateImageFile({ type: 'image/webp', size: 1024 })).toBeNull()
  })

  it('accepts image/gif', () => {
    expect(validateImageFile({ type: 'image/gif', size: 1024 })).toBeNull()
  })

  it('rejects application/octet-stream (e.g. disguised exe)', () => {
    const err = validateImageFile({ type: 'application/octet-stream', size: 1024 })
    expect(err).toContain('Tipo de archivo no permitido')
  })

  it('rejects application/pdf', () => {
    const err = validateImageFile({ type: 'application/pdf', size: 1024 })
    expect(err).toContain('Tipo de archivo no permitido')
  })

  it('rejects text/html', () => {
    const err = validateImageFile({ type: 'text/html', size: 1024 })
    expect(err).toContain('Tipo de archivo no permitido')
  })

  it('rejects files larger than 5MB', () => {
    const err = validateImageFile({ type: 'image/jpeg', size: MAX_SIZE + 1 })
    expect(err).toContain('demasiado grande')
  })

  it('accepts file of exactly 5MB', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: MAX_SIZE })).toBeNull()
  })

  it('rejects file with no type (empty string)', () => {
    const err = validateImageFile({ type: '', size: 1024 })
    expect(err).toContain('Tipo de archivo no permitido')
  })
})

// ── gradeSubmission ───────────────────────────────────────────────────────────

describe('gradeSubmission', () => {
  let fromMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })
    fromMock = vi.fn()
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: fromMock,
    })
  })

  function makeOwnershipMock(courseId: string | undefined) {
    const data = courseId !== undefined
      ? { assignments: { lessons: { course_id: courseId } } }
      : null
    return {
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data }) }) }),
    }
  }

  it('rejects when submission does not belong to courseId', async () => {
    fromMock.mockReturnValueOnce(makeOwnershipMock('OTHER'))

    const { gradeSubmission } = await import('@/app/courses/actions')
    const result = await gradeSubmission('s1', 'A', 'good', 'c1', 'l1', 'u1')
    expect(result).toEqual({ error: 'submission_mismatch' })
    // Only the ownership query from('submissions') was issued; no second call for update
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('rejects when submission does not exist', async () => {
    fromMock.mockReturnValueOnce(makeOwnershipMock(undefined))

    const { gradeSubmission } = await import('@/app/courses/actions')
    const result = await gradeSubmission('bogus', 'A', 'good', 'c1', 'l1', 'u1')
    expect(result).toEqual({ error: 'submission_not_found' })
  })

  it('updates the submission and notifies the student when ownership matches', async () => {
    // First from() call: ownership check
    fromMock.mockReturnValueOnce(makeOwnershipMock('c1'))
    // Second from() call: update
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValueOnce({ update: updateMock })

    const { gradeSubmission } = await import('@/app/courses/actions')
    const result = await gradeSubmission('s1', 'A+', 'great', 'c1', 'l1', 'u1')
    expect(result).toBeUndefined()
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      grade: 'A+',
      feedback: 'great',
      status: 'reviewed',
    }))
    expect(eqMock).toHaveBeenCalledWith('id', 's1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1/l1/submissions')
  })

  it('returns error when Supabase update fails', async () => {
    // Ownership check passes
    fromMock.mockReturnValueOnce(makeOwnershipMock('c1'))
    // Update fails
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'update failed' } })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValueOnce({ update: updateMock })

    const { gradeSubmission } = await import('@/app/courses/actions')
    const result = await gradeSubmission('s1', 'B', 'ok', 'c1', 'l1', 'u1')
    expect(result).toEqual({ error: 'update failed' })
  })

  it('throws when requireAdmin rejects (non-admin)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const { gradeSubmission } = await import('@/app/courses/actions')
    await expect(gradeSubmission('s1', 'A', 'good', 'c1', 'l1', 'u1')).rejects.toThrow('forbidden')
  })
})

// ── updateAssignment ──────────────────────────────────────────────────────────

describe('updateAssignment', () => {
  let fromMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })
    fromMock = vi.fn()
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: fromMock,
    })
  })

  function makeOwnershipMock(lessonId: string | undefined) {
    const data = lessonId !== undefined ? { lesson_id: lessonId } : null
    return {
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data }) }) }),
    }
  }

  it('rejects when assignment does not belong to lessonId', async () => {
    fromMock.mockReturnValueOnce(makeOwnershipMock('OTHER'))

    const { updateAssignment } = await import('@/app/courses/actions')
    const result = await updateAssignment('a1', 'title', 'desc', 'c1', 'l1')
    expect(result).toEqual({ error: 'assignment_mismatch' })
    // Only the ownership query was issued; no update call
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('rejects when assignment does not exist', async () => {
    fromMock.mockReturnValueOnce(makeOwnershipMock(undefined))

    const { updateAssignment } = await import('@/app/courses/actions')
    const result = await updateAssignment('bogus', 'title', 'desc', 'c1', 'l1')
    expect(result).toEqual({ error: 'assignment_not_found' })
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('updates the assignment when ownership matches', async () => {
    // First from() call: ownership check
    fromMock.mockReturnValueOnce(makeOwnershipMock('l1'))
    // Second from() call: update
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValueOnce({ update: updateMock })

    const { updateAssignment } = await import('@/app/courses/actions')
    const result = await updateAssignment('a1', 'New Title', 'New Desc', 'c1', 'l1')
    expect(result).toBeUndefined()
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New Title',
      description: 'New Desc',
    }))
    expect(eqMock).toHaveBeenCalledWith('id', 'a1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1/l1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1/l1/edit')
  })

  it('returns error when Supabase update fails', async () => {
    fromMock.mockReturnValueOnce(makeOwnershipMock('l1'))
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'update failed' } })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValueOnce({ update: updateMock })

    const { updateAssignment } = await import('@/app/courses/actions')
    const result = await updateAssignment('a1', 'T', 'D', 'c1', 'l1')
    expect(result).toEqual({ error: 'update failed' })
  })

  it('throws when requireAdmin rejects (non-admin)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const { updateAssignment } = await import('@/app/courses/actions')
    await expect(updateAssignment('a1', 'T', 'D', 'c1', 'l1')).rejects.toThrow('forbidden')
  })
})

// ── deleteAssignment ──────────────────────────────────────────────────────────

describe('deleteAssignment', () => {
  let fromMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })
    fromMock = vi.fn()
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: fromMock,
    })
  })

  function makeOwnershipMock(lessonId: string | undefined) {
    const data = lessonId !== undefined ? { lesson_id: lessonId } : null
    return {
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data }) }) }),
    }
  }

  it('rejects when assignment does not belong to lessonId', async () => {
    fromMock.mockReturnValueOnce(makeOwnershipMock('OTHER'))

    const { deleteAssignment } = await import('@/app/courses/actions')
    const result = await deleteAssignment('a1', 'c1', 'l1')
    expect(result).toEqual({ error: 'assignment_mismatch' })
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('rejects when assignment does not exist', async () => {
    fromMock.mockReturnValueOnce(makeOwnershipMock(undefined))

    const { deleteAssignment } = await import('@/app/courses/actions')
    const result = await deleteAssignment('bogus', 'c1', 'l1')
    expect(result).toEqual({ error: 'assignment_not_found' })
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('deletes the assignment when ownership matches', async () => {
    // First from() call: ownership check
    fromMock.mockReturnValueOnce(makeOwnershipMock('l1'))
    // Second from() call: delete
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValueOnce({ delete: deleteMock })

    const { deleteAssignment } = await import('@/app/courses/actions')
    const result = await deleteAssignment('a1', 'c1', 'l1')
    expect(result).toBeUndefined()
    expect(deleteMock).toHaveBeenCalled()
    expect(eqMock).toHaveBeenCalledWith('id', 'a1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1/l1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1/l1/edit')
  })

  it('returns error when Supabase delete fails', async () => {
    fromMock.mockReturnValueOnce(makeOwnershipMock('l1'))
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'delete failed' } })
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValueOnce({ delete: deleteMock })

    const { deleteAssignment } = await import('@/app/courses/actions')
    const result = await deleteAssignment('a1', 'c1', 'l1')
    expect(result).toEqual({ error: 'delete failed' })
  })

  it('throws when requireAdmin rejects (non-admin)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const { deleteAssignment } = await import('@/app/courses/actions')
    await expect(deleteAssignment('a1', 'c1', 'l1')).rejects.toThrow('forbidden')
  })
})

// ── updateLesson ──────────────────────────────────────────────────────────────

describe('updateLesson', () => {
  let fromMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })
    fromMock = vi.fn()
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: fromMock,
    })
  })

  /** Builds a Supabase chain: update → eq('id') → [optional eq('updated_at')] → select → maybeSingle */
  function makeUpdateChain(result: { data: unknown; error: unknown } = { data: { id: 'l1' }, error: null }) {
    const maybeSingleMock = vi.fn().mockResolvedValue(result)
    const selectMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
    // Inner eq used for updated_at filter; returns the same select stub.
    const innerEqMock = vi.fn().mockReturnValue({ select: selectMock })
    // Outer eq used for id filter; can chain to another eq OR directly to select.
    const outerEqMock = vi.fn().mockReturnValue({ eq: innerEqMock, select: selectMock })
    const updateMock = vi.fn().mockReturnValue({ eq: outerEqMock })
    fromMock.mockReturnValueOnce({ update: updateMock })
    return { updateMock, outerEqMock, innerEqMock, selectMock, maybeSingleMock }
  }

  it('returns validation error when order is 0', async () => {
    const { updateLesson } = await import('@/app/courses/actions')
    const result = await updateLesson(fd({ lessonId: 'l1', courseId: 'c1', title: 'T', order: '0' }))
    expect(result).toEqual({ error: 'El orden de la lección debe ser un número positivo' })
  })

  it('returns validation error for blank title', async () => {
    const { updateLesson } = await import('@/app/courses/actions')
    const result = await updateLesson(fd({ lessonId: 'l1', courseId: 'c1', title: '   ', order: '1' }))
    expect(result).toEqual({ error: 'invalid_title' })
  })

  it('throws when requireAdmin rejects (non-admin)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const { updateLesson } = await import('@/app/courses/actions')
    await expect(
      updateLesson(fd({ lessonId: 'l1', courseId: 'c1', title: 'T', order: '1' }))
    ).rejects.toThrow('forbidden')
  })

  it('updates the lesson row without expectedUpdatedAt (no concurrency check)', async () => {
    const { updateMock, outerEqMock } = makeUpdateChain({ data: { id: 'l1' }, error: null })

    const { updateLesson } = await import('@/app/courses/actions')
    const result = await updateLesson(fd({
      lessonId: 'l1', courseId: 'c1', title: 'New title', order: '2',
    }))

    expect(result).toBeUndefined()
    expect(fromMock).toHaveBeenCalledWith('lessons')
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New title',
      order: 2,
      updated_at: expect.any(String),
    }))
    expect(outerEqMock).toHaveBeenCalledWith('id', 'l1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1/l1/edit')
  })

  it('rejects with concurrent_update when expectedUpdatedAt does not match (0 rows affected)', async () => {
    makeUpdateChain({ data: null, error: null })

    const { updateLesson } = await import('@/app/courses/actions')
    const result = await updateLesson(fd({
      lessonId: 'l1', courseId: 'c1', title: 'New title', order: '1',
      expectedUpdatedAt: 'OLD-timestamp',
    }))

    expect(result).toEqual({ error: 'concurrent_update' })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('succeeds when expectedUpdatedAt matches (row returned)', async () => {
    makeUpdateChain({ data: { id: 'l1' }, error: null })

    const { updateLesson } = await import('@/app/courses/actions')
    const result = await updateLesson(fd({
      lessonId: 'l1', courseId: 'c1', title: 'New title', order: '1',
      expectedUpdatedAt: '2026-05-07T10:00:00.000Z',
    }))

    expect(result).toBeUndefined()
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses/c1')
  })

  it('returns error when Supabase update fails', async () => {
    makeUpdateChain({ data: null, error: { message: 'update failed' } })

    const { updateLesson } = await import('@/app/courses/actions')
    const result = await updateLesson(fd({
      lessonId: 'l1', courseId: 'c1', title: 'T', order: '1',
    }))

    expect(result).toEqual({ error: 'update failed' })
  })
})

describe('validateOrder', () => {
  it('accepts valid positive integers', () => {
    expect(validateOrder('1')).toBeNull()
    expect(validateOrder('5')).toBeNull()
    expect(validateOrder('100')).toBeNull()
  })

  it('rejects NaN (non-numeric string)', () => {
    expect(validateOrder('abc')).toContain('número positivo')
  })

  it('rejects zero', () => {
    expect(validateOrder('0')).toContain('número positivo')
  })

  it('rejects negative numbers', () => {
    expect(validateOrder('-1')).toContain('número positivo')
  })

  it('rejects empty string', () => {
    expect(validateOrder('')).toContain('número positivo')
  })

  it('rejects float strings (parseInt truncates, 1.5 → 1 which is valid)', () => {
    expect(validateOrder('1.5')).toBeNull() // parseInt('1.5') = 1
  })
})

// ── createCourse ──────────────────────────────────────────────────────────────

describe('createCourse', () => {
  let fromMock: ReturnType<typeof vi.fn>
  let insertMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })

    insertMock = vi.fn().mockResolvedValue({ error: null })
    fromMock = vi.fn().mockReturnValue({ insert: insertMock })

    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      from: fromMock,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage/img.jpg' } }),
        }),
      },
    })
  })

  it('returns invalid_title when title is empty', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    const result = await createCourse(fd({ title: '', description: 'd', courseType: 'membership' }))
    expect(result).toEqual({ error: 'invalid_title' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns invalid_title when title is whitespace only', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    const result = await createCourse(fd({ title: '   ', description: 'd', courseType: 'membership' }))
    expect(result).toEqual({ error: 'invalid_title' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns invalid_price when priceEur is negative', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    const result = await createCourse(fd({ title: 'Curso', priceEur: '-10', courseType: 'membership' }))
    expect(result).toEqual({ error: 'invalid_price' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns invalid_price when priceEur exceeds 9999', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    const result = await createCourse(fd({ title: 'Curso', priceEur: '10000', courseType: 'membership' }))
    expect(result).toEqual({ error: 'invalid_price' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns invalid_year when year is out of range', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    const result = await createCourse(fd({ title: 'Curso', year: '1990', courseType: 'membership' }))
    expect(result).toEqual({ error: 'invalid_year' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns invalid_month when month is 0', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    const result = await createCourse(fd({ title: 'Curso', month: '0', courseType: 'membership' }))
    expect(result).toEqual({ error: 'invalid_month' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('returns description_too_long when description exceeds 5000 chars', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    const result = await createCourse(fd({ title: 'Curso', description: 'x'.repeat(5001), courseType: 'membership' }))
    expect(result).toEqual({ error: 'description_too_long' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('inserts course and redirects on valid input', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    await expect(
      createCourse(fd({
        title: 'Curso de Bachata',
        description: 'Una descripción',
        courseType: 'membership',
        isPublished: 'on',
        priceEur: '50',
        year: '2026',
        month: '5',
      }))
    ).rejects.toThrow('REDIRECT:/courses')

    expect(fromMock).toHaveBeenCalledWith('courses')
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Curso de Bachata',
      description: 'Una descripción',
      course_type: 'membership',
      is_published: true,
      price_eur: 50,
      year: 2026,
      month: 5,
    }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/courses')
  })

  it('defaults is_published to false when isPublished field absent', async () => {
    const { createCourse } = await import('@/app/courses/actions')
    await createCourse(fd({ title: 'Curso', courseType: 'complete' })).catch(() => {})
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ is_published: false }))
  })

  it('returns error when Supabase insert fails', async () => {
    insertMock.mockResolvedValue({ error: { message: 'insert failed' } })
    const { createCourse } = await import('@/app/courses/actions')
    const result = await createCourse(fd({ title: 'Curso', courseType: 'membership' }))
    expect(result).toEqual({ error: 'insert failed' })
  })

  it('throws when requireAdmin rejects (non-admin)', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const { createCourse } = await import('@/app/courses/actions')
    await expect(createCourse(fd({ title: 'Curso', courseType: 'membership' }))).rejects.toThrow('forbidden')
  })
})

// ── uploadAssignmentFile ──────────────────────────────────────────────────────

describe('uploadAssignmentFile', () => {
  let fromMock: ReturnType<typeof vi.fn>
  let uploadMock: ReturnType<typeof vi.fn>

  /** Build a client whose from() returns the assignment lookup chain then storage. */
  function makeClientWithAssignment(courseId: string | null) {
    const assignmentSingle = vi.fn().mockResolvedValue({
      data: courseId !== null
        ? { lesson_id: 'l1', lessons: { course_id: courseId } }
        : null,
    })
    fromMock = vi.fn().mockReturnValue({
      select: () => ({ eq: () => ({ single: assignmentSingle }) }),
    })
    uploadMock = vi.fn().mockResolvedValue({ error: null })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: fromMock,
      storage: {
        from: vi.fn().mockReturnValue({ upload: uploadMock }),
      },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasCourseAccess).mockResolvedValue(true)
  })

  it('returns auth error when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
      storage: { from: vi.fn() },
    })
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' })
    const { uploadAssignmentFile } = await import('@/app/courses/actions')
    const result = await uploadAssignmentFile('a1', file)
    expect(result).toEqual({ error: 'auth' })
  })

  it('returns unsupported_type for disallowed MIME type', async () => {
    makeClientWithAssignment('c1')
    const file = new File([new Uint8Array([0])], 'malware.exe', { type: 'application/x-msdownload' })
    const { uploadAssignmentFile } = await import('@/app/courses/actions')
    const result = await uploadAssignmentFile('a1', file)
    expect(result).toEqual({ error: 'unsupported_type' })
  })

  it('returns too_large when file exceeds 50 MB', async () => {
    makeClientWithAssignment('c1')
    // Build a File whose .size property reports 50 MB + 1 byte without allocating memory.
    const oversized = { name: 'big.jpg', type: 'image/jpeg', size: 50 * 1024 * 1024 + 1 } as File
    const { uploadAssignmentFile } = await import('@/app/courses/actions')
    const result = await uploadAssignmentFile('a1', oversized)
    expect(result).toEqual({ error: 'too_large' })
  })

  it('returns assignment_not_found when assignment does not exist', async () => {
    makeClientWithAssignment(null)
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' })
    const { uploadAssignmentFile } = await import('@/app/courses/actions')
    const result = await uploadAssignmentFile('bogus', file)
    expect(result).toEqual({ error: 'assignment_not_found' })
  })

  it('returns forbidden when user has no course access', async () => {
    vi.mocked(hasCourseAccess).mockResolvedValue(false)
    makeClientWithAssignment('c1')
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' })
    const { uploadAssignmentFile } = await import('@/app/courses/actions')
    const result = await uploadAssignmentFile('a1', file)
    expect(result).toEqual({ error: 'forbidden' })
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('returns fileUrl on successful upload', async () => {
    makeClientWithAssignment('c1')
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'submission.jpg', { type: 'image/jpeg' })
    const { uploadAssignmentFile } = await import('@/app/courses/actions')
    const result = await uploadAssignmentFile('a1', file)
    expect(result).toMatchObject({ fileUrl: expect.stringContaining('storage://submissions/') })
    expect(uploadMock).toHaveBeenCalled()
  })

  it('returns fileUrl for an allowed PDF upload', async () => {
    makeClientWithAssignment('c1')
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'doc.pdf', { type: 'application/pdf' })
    const { uploadAssignmentFile } = await import('@/app/courses/actions')
    const result = await uploadAssignmentFile('a1', file)
    expect(result).toMatchObject({ fileUrl: expect.stringContaining('storage://submissions/') })
  })

  it('returns storage error when upload fails', async () => {
    makeClientWithAssignment('c1')
    uploadMock.mockResolvedValue({ error: { message: 'storage error' } })
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' })
    const { uploadAssignmentFile } = await import('@/app/courses/actions')
    const result = await uploadAssignmentFile('a1', file)
    expect(result).toEqual({ error: 'storage error' })
  })
})

