import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNotify = vi.fn()
vi.mock('@/utils/notifications/server', () => ({ notify: mockNotify }))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => { mockNotify.mockReset(); mockNotify.mockResolvedValue(undefined) })

describe('togglePostLike', () => {
  it('inserts like and notifies post author when not yet liked', async () => {
    const likeCheckChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const likeInsertChain = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const postChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: 'post-author-1' }, error: null }),
    }

    let likeCalls = 0
    const from = vi.fn((table: string) => {
      if (table === 'post_likes') {
        likeCalls += 1
        return likeCalls === 1 ? likeCheckChain : likeInsertChain
      }
      if (table === 'posts') return postChain
      throw new Error(`unexpected: ${table}`)
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'liker-1' } } }) },
      from,
    } as never)

    const { togglePostLike } = await import('@/app/actions/community-likes')
    await togglePostLike('post-1')

    expect(likeInsertChain.insert).toHaveBeenCalledWith({ post_id: 'post-1', user_id: 'liker-1' })
    expect(mockNotify).toHaveBeenCalledWith({
      recipientId: 'post-author-1',
      actorId: 'liker-1',
      type: 'post_like',
      entityType: 'post',
      entityId: 'post-1',
      link: '/community/post-1',
    })
  })

  it('removes like and does NOT notify when already liked', async () => {
    const likeCheckChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'like-1' }, error: null }),
    }
    const likeDeleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    let calls = 0
    const from = vi.fn((table: string) => {
      if (table !== 'post_likes') throw new Error('unexpected')
      calls += 1
      return calls === 1 ? likeCheckChain : likeDeleteChain
    })

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'liker-1' } } }) },
      from,
    } as never)

    const { togglePostLike } = await import('@/app/actions/community-likes')
    await togglePostLike('post-1')

    expect(likeDeleteChain.delete).toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled()
  })
})
