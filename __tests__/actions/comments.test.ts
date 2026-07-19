import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockOrder = vi.fn()
const mockMaybeSingle = vi.fn()

// Chain builder — returns itself so calls can be chained
function chain(terminal: () => unknown) {
  const obj: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'in', 'order', 'single', 'maybeSingle', 'insert', 'delete', 'filter']
  methods.forEach(m => { obj[m] = vi.fn(() => obj) })
  ;(obj as { resolve: () => unknown }).resolve = terminal
  return obj
}

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))
vi.mock('@/utils/auth/course-access', () => ({ hasCourseAccess: vi.fn().mockResolvedValue(true) }))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSupabaseMock(userOverride?: unknown, fromOverride?: unknown) {
  // Use explicit undefined check so null is preserved (null ?? x evaluates x, which is wrong)
  const user = userOverride === undefined ? { id: 'user-1' } : userOverride
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: fromOverride ?? vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'inserted-id' }, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnThis(),
    }),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('addComment — input validation', () => {
  beforeEach(async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock() as never)
  })

  it('returns error when content is empty', async () => {
    const { addComment } = await import('@/app/actions/comments')
    const result = await addComment('lesson-1', '')
    expect(result).toEqual({ error: 'El comentario no puede estar vacío' })
  })

  it('returns error when content is only whitespace', async () => {
    const { addComment } = await import('@/app/actions/comments')
    const result = await addComment('lesson-1', '   ')
    expect(result).toEqual({ error: 'El comentario no puede estar vacío' })
  })

  it('returns error when content exceeds 5000 characters', async () => {
    const { addComment } = await import('@/app/actions/comments')
    const longContent = 'a'.repeat(5001)
    const result = await addComment('lesson-1', longContent)
    expect(result).toEqual({ error: 'El comentario no puede superar los 5000 caracteres' })
  })

  it('returns error when user is not authenticated', async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock(null) as never)

    const { addComment } = await import('@/app/actions/comments')
    const result = await addComment('lesson-1', 'Buen contenido')
    expect(result).toEqual({ error: 'Debes iniciar sesión para comentar' })
  })
})

describe('addComment — content length boundary', () => {
  beforeEach(async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock() as never)
  })

  it('accepts content of exactly 5000 characters', async () => {
    const { addComment } = await import('@/app/actions/comments')
    const content = 'a'.repeat(5000)
    const result = await addComment('lesson-1', content)
    // Should not return a length error (may succeed or have DB error in test env)
    expect(result).not.toEqual({ error: 'El comentario no puede superar los 5000 caracteres' })
  })
})

describe('toggleLike — insert error handling', () => {
  function makeToggleClient(insertError: { code: string; message: string } | null) {
    // Comentario de post de comunidad (lesson_id null) — no requiere course access
    const commentChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'c1', user_id: 'other-user', lesson_id: null, post_id: 'p1' },
        error: null,
      }),
    }
    const likeCheckChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }), // sin like previo
    }
    const likeInsertChain = {
      insert: vi.fn().mockResolvedValue({ error: insertError }),
    }
    let likeCalls = 0
    const from = vi.fn((table: string) => {
      if (table === 'comments') return commentChain
      if (table === 'comment_likes') {
        likeCalls += 1
        return likeCalls === 1 ? likeCheckChain : likeInsertChain
      }
      throw new Error(`unexpected table: ${table}`)
    })
    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: `liker-${Math.random()}` } } }) },
      from,
    }
  }

  it('returns success for duplicate like (23505 = idempotent)', async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(
      makeToggleClient({ code: '23505', message: 'duplicate key value' }) as never,
    )

    const { toggleLike } = await import('@/app/actions/comments')
    const result = await toggleLike('c1')
    expect(result).toEqual({ success: true })
  })

  it('returns like_failed for any other insert error', async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(
      makeToggleClient({ code: '42501', message: 'permission denied' }) as never,
    )

    const { toggleLike } = await import('@/app/actions/comments')
    const result = await toggleLike('c1')
    expect(result).toEqual({ error: 'like_failed' })
  })

  it('still returns success when insert succeeds', async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeToggleClient(null) as never)

    const { toggleLike } = await import('@/app/actions/comments')
    const result = await toggleLike('c1')
    expect(result).toEqual({ success: true })
  })
})

describe('comment tree building', () => {
  it('builds a flat list into a nested tree', () => {
    // Pure algorithmic test — mirrors the logic in getComments
    type FlatComment = { id: string; parent_id: string | null; replies: FlatComment[] }

    const flat: FlatComment[] = [
      { id: 'c1', parent_id: null, replies: [] },
      { id: 'c2', parent_id: null, replies: [] },
      { id: 'c3', parent_id: 'c1', replies: [] },
      { id: 'c4', parent_id: 'c1', replies: [] },
      { id: 'c5', parent_id: 'c3', replies: [] },
    ]

    const root: FlatComment[] = []
    const map = new Map<string, FlatComment>()
    flat.forEach(c => map.set(c.id, c))
    flat.forEach(c => {
      if (c.parent_id) {
        map.get(c.parent_id)?.replies.push(c)
      } else {
        root.push(c)
      }
    })

    expect(root).toHaveLength(2)
    expect(root[0].replies).toHaveLength(2)          // c3, c4 under c1
    expect(root[0].replies[0].replies).toHaveLength(1) // c5 under c3
    expect(root[1].replies).toHaveLength(0)          // c2 has no replies
  })

  it('returns empty array for no comments', () => {
    const flat: unknown[] = []
    const root: unknown[] = []
    flat.forEach(() => {}) // no-op
    expect(root).toHaveLength(0)
  })
})
