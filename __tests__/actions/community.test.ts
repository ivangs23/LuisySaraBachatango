import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
const mockGetUser = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

function makeClient(userId: string | null = 'user-1') {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }) },
    from: mockFrom,
  }
}

describe('submitPost — length validation', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient() as never)
  })

  it('does not insert when title exceeds 200 characters', async () => {
    const { submitPost } = await import('@/app/community/actions')
    const fd = new FormData()
    fd.set('title', 'a'.repeat(201))
    fd.set('content', 'Valid content')
    const result = await submitPost(fd)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'Título demasiado largo.' })
  })

  it('does not insert when content exceeds 10000 characters', async () => {
    const { submitPost } = await import('@/app/community/actions')
    const fd = new FormData()
    fd.set('title', 'Valid title')
    fd.set('content', 'a'.repeat(10001))
    const result = await submitPost(fd)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'Contenido demasiado largo.' })
  })

  it('does not insert when title is empty', async () => {
    const { submitPost } = await import('@/app/community/actions')
    const fd = new FormData()
    fd.set('title', '')
    fd.set('content', 'Valid content')
    const result = await submitPost(fd)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
  })

  it('does not insert when content is empty', async () => {
    const { submitPost } = await import('@/app/community/actions')
    const fd = new FormData()
    fd.set('title', 'Valid title')
    fd.set('content', '')
    const result = await submitPost(fd)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
  })

  it('accepts title of exactly 200 characters', async () => {
    mockInsert.mockResolvedValue({ error: null })
    const { submitPost } = await import('@/app/community/actions')
    const fd = new FormData()
    fd.set('title', 'a'.repeat(200))
    fd.set('content', 'Valid content')
    const result = await submitPost(fd)
    expect(mockInsert).toHaveBeenCalled()
    expect(result).toEqual({ success: true })
  })
})

describe('submitComment — length validation', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient() as never)
  })

  it('does not insert when comment content exceeds 5000 characters', async () => {
    const { submitComment } = await import('@/app/community/actions')
    const fd = new FormData()
    fd.set('postId', 'post-1')
    fd.set('content', 'a'.repeat(5001))
    const result = await submitComment(fd)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'Comentario demasiado largo.' })
  })

  it('does not insert when postId is missing', async () => {
    const { submitComment } = await import('@/app/community/actions')
    const fd = new FormData()
    fd.set('content', 'Valid comment')
    const result = await submitComment(fd)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
  })
})
