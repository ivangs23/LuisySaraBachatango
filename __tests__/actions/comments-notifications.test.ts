import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNotify = vi.fn()
vi.mock('@/utils/notifications/server', () => ({ notify: mockNotify }))

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

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
    const lessonChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
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
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'top-1' }, error: null }),
    }
    const from = vi.fn(() => insertChain)

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as never)

    const { addComment } = await import('@/app/actions/comments')
    await addComment('lesson-1', 'Hello world', null, 'course-1')

    expect(mockNotify).not.toHaveBeenCalled()
  })
})
