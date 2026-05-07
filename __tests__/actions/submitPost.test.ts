import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _resetRateLimitForTest } from '@/utils/rate-limit'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

const insertMock = vi.fn()
const getUser = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ insert: insertMock }),
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { submitPost } from '@/app/community/actions'

function fd(values: Record<string, string>) {
  const f = new FormData()
  Object.entries(values).forEach(([k, v]) => f.append(k, v))
  return f
}

describe('submitPost', () => {
  beforeEach(() => {
    insertMock.mockReset()
    getUser.mockReset()
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    _resetRateLimitForTest()
  })

  it('rejects without auth', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const result = await submitPost(fd({ title: 't', content: 'c' }))
    expect(result).toEqual({ success: false, error: 'auth' })
  })

  it('rejects empty title', async () => {
    const result = await submitPost(fd({ title: '   ', content: 'some content' }))
    expect(result.success).toBe(false)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects empty content', async () => {
    const result = await submitPost(fd({ title: 'Valid title', content: '' }))
    expect(result.success).toBe(false)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects title over 200 characters', async () => {
    const result = await submitPost(fd({ title: 'a'.repeat(201), content: 'valid content' }))
    expect(result).toEqual({ success: false, error: 'Título demasiado largo.' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects content over 10000 characters', async () => {
    const result = await submitPost(fd({ title: 'valid title', content: 'a'.repeat(10001) }))
    expect(result).toEqual({ success: false, error: 'Contenido demasiado largo.' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('inserts and returns success', async () => {
    insertMock.mockResolvedValue({ error: null })
    const result = await submitPost(fd({ title: 'hello', content: 'world' }))
    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'hello',
      content: 'world',
      user_id: 'u1',
    }))
  })

  it('returns error when DB insert fails', async () => {
    insertMock.mockResolvedValue({ error: { message: 'db error' } })
    const result = await submitPost(fd({ title: 'hello', content: 'world' }))
    expect(result).toEqual({ success: false, error: 'No se pudo crear el post.' })
  })
})
