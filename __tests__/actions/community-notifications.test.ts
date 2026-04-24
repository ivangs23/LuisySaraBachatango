import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNotify = vi.fn()
vi.mock('@/utils/notifications/server', () => ({ notify: mockNotify }))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

beforeEach(() => mockNotify.mockReset())

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v))
  return fd
}

describe('submitComment — notifications', () => {
  it('notifies the post author when adding a top-level comment', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'new-comment-1' }, error: null }),
    }
    const postChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: 'post-author-1' }, error: null }),
    }
    const from = vi.fn((table: string) => {
      if (table === 'comments') return insertChain
      if (table === 'posts') return postChain
      throw new Error(`unexpected: ${table}`)
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'commenter-1' } } }) },
      from,
    } as never)

    const { submitComment } = await import('@/app/community/actions')
    await submitComment(makeFormData({ postId: 'post-1', content: 'Nice post!' }))

    expect(mockNotify).toHaveBeenCalledTimes(1)
    expect(mockNotify).toHaveBeenCalledWith({
      recipientId: 'post-author-1',
      actorId: 'commenter-1',
      type: 'post_comment',
      entityType: 'post',
      entityId: 'post-1',
      link: '/community/post-1#comment-new-comment-1',
    })
  })

  it('notifies only the parent comment author when parentId is given (no post_comment spam)', async () => {
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'reply-1' }, error: null }),
    }
    const parentChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: 'parent-author-1' }, error: null }),
    }

    let commentsCalls = 0
    const from = vi.fn((table: string) => {
      if (table === 'comments') {
        commentsCalls += 1
        return commentsCalls === 1 ? insertChain : parentChain
      }
      throw new Error(`unexpected: ${table}`)
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'commenter-1' } } }) },
      from,
    } as never)

    const { submitComment } = await import('@/app/community/actions')
    await submitComment(makeFormData({
      postId: 'post-1',
      content: 'Replying',
      parentId: 'parent-comment-1',
    }))

    expect(mockNotify).toHaveBeenCalledTimes(1)
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'comment_reply',
      recipientId: 'parent-author-1',
      entityId: 'reply-1',
    }))
  })
})
