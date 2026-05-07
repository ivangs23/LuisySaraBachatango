import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hasCourseAccess } from '@/utils/auth/course-access'

const mockNotify = vi.fn()
vi.mock('@/utils/notifications/server', () => ({ notify: mockNotify }))

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/auth/course-access', () => ({ hasCourseAccess: vi.fn() }))
vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
  _resetRateLimitForTest: vi.fn(),
}))

function makeChain(returns: Record<string, unknown>) {
  const obj: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returns.single ?? { data: null, error: null }),
    insert: vi.fn().mockResolvedValue(returns.insert ?? { data: null, error: null }),
    delete: vi.fn().mockReturnThis(),
  }
  return obj
}

beforeEach(() => {
  mockNotify.mockReset()
  mockNotify.mockResolvedValue(undefined)
})

describe('toggleLike — notifications', () => {
  it('notifies the comment author when adding a like (lesson context)', async () => {
    const commentChain = makeChain({
      single: { data: { id: 'comment-1', user_id: 'author-1', lesson_id: 'lesson-1', post_id: null }, error: null },
    })
    const likeCheckChain = makeChain({
      single: { data: null, error: null }, // not yet liked
    })
    const likeInsertChain = makeChain({
      insert: { data: null, error: null },
    })
    const lessonChain = makeChain({
      single: { data: { course_id: 'course-1' }, error: null },
    })

    let likeCalls = 0
    const from = vi.fn((table: string) => {
      if (table === 'comments') return commentChain
      if (table === 'lessons') return lessonChain
      if (table === 'comment_likes') {
        likeCalls += 1
        return likeCalls === 1 ? likeCheckChain : likeInsertChain
      }
      return makeChain({})
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'liker-1' } } }) },
      from,
    } as never)

    const { toggleLike } = await import('@/app/actions/comments')
    await toggleLike('comment-1')

    expect(mockNotify).toHaveBeenCalledWith({
      recipientId: 'author-1',
      actorId: 'liker-1',
      type: 'comment_like',
      entityType: 'comment',
      entityId: 'comment-1',
      link: '/courses/course-1/lesson-1#comment-comment-1',
    })
  })

  it('does NOT notify when removing a like', async () => {
    const commentChain = makeChain({
      single: { data: { id: 'comment-1', user_id: 'author-1', lesson_id: 'lesson-1', post_id: null }, error: null },
    })
    const likeCheckChain = makeChain({
      single: { data: { id: 'like-1' }, error: null }, // already liked
    })
    const likeDeleteChain = makeChain({})

    let likeCalls = 0
    const from = vi.fn((table: string) => {
      if (table === 'comments') return commentChain
      if (table === 'comment_likes') {
        likeCalls += 1
        return likeCalls === 1 ? likeCheckChain : likeDeleteChain
      }
      return makeChain({})
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'liker-1' } } }) },
      from,
    } as never)

    const { toggleLike } = await import('@/app/actions/comments')
    await toggleLike('comment-1')

    expect(mockNotify).not.toHaveBeenCalled()
  })
})

describe('addComment — notifications', () => {
  beforeEach(() => {
    vi.mocked(hasCourseAccess).mockResolvedValue(true)
  })

  it('notifies the parent comment author when posting a reply', async () => {
    const insertedId = 'reply-1'
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: insertedId }, error: null }),
    }
    const parentChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { user_id: 'parent-author-1', lesson_id: 'lesson-1' },
        error: null,
      }),
    }
    // lessonChain handles both the initial access-check lookup (maybeSingle)
    // and the notification link lookup (single) — both return the same course_id.
    const lessonChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
    }

    let commentsCallCount = 0
    const from = vi.fn((table: string) => {
      if (table === 'comments') {
        commentsCallCount += 1
        return commentsCallCount === 1 ? insertChain : parentChain
      }
      if (table === 'lessons') return lessonChain
      throw new Error(`Unexpected table: ${table}`)
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'replier-1' } } }) },
      from,
    } as never)

    const { addComment } = await import('@/app/actions/comments')
    await addComment('lesson-1', 'My reply', 'parent-comment-1', 'course-1')

    expect(mockNotify).toHaveBeenCalledWith({
      recipientId: 'parent-author-1',
      actorId: 'replier-1',
      type: 'comment_reply',
      entityType: 'comment',
      entityId: insertedId,
      link: '/courses/course-1/lesson-1#comment-reply-1',
    })
  })

  it('does NOT notify when posting a top-level comment (no parentId)', async () => {
    const lessonChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
      single: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
    }
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'top-1' }, error: null }),
    }
    const from = vi.fn((table: string) => {
      if (table === 'lessons') return lessonChain
      return insertChain
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as never)

    const { addComment } = await import('@/app/actions/comments')
    await addComment('lesson-1', 'Hello world', null, 'course-1')

    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('rejects when user has no access to the course', async () => {
    vi.mocked(hasCourseAccess).mockResolvedValue(false)

    const lessonChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
    }
    const insertMock = vi.fn()
    const from = vi.fn((table: string) => {
      if (table === 'lessons') return lessonChain
      return { insert: insertMock }
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as never)

    const { addComment } = await import('@/app/actions/comments')
    const result = await addComment('lesson-1', 'hello', null)

    expect(result).toEqual({ error: 'forbidden' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects when lesson does not exist', async () => {
    vi.mocked(hasCourseAccess).mockResolvedValue(true)

    const lessonChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const insertMock = vi.fn()
    const from = vi.fn((table: string) => {
      if (table === 'lessons') return lessonChain
      return { insert: insertMock }
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as never)

    const { addComment } = await import('@/app/actions/comments')
    const result = await addComment('bogus-id', 'hello', null)

    expect(result).toEqual({ error: 'lesson_not_found' })
    expect(insertMock).not.toHaveBeenCalled()
  })
})
