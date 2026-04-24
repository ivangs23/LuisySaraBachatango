import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

// A thenable+chainable Supabase query-builder mock.
function makeBuilder(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const calls: { method: string; args: unknown[] }[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    calls,
    then: (resolve: (v: unknown) => void) => resolve(result),
  }
  for (const m of ['select', 'eq', 'update', 'insert', 'delete', 'order', 'in', 'single']) {
    builder[m] = vi.fn((...args: unknown[]) => {
      calls.push({ method: m, args })
      return builder
    })
  }
  return builder
}

describe('markAsRead', () => {
  it('updates the row scoped to the current user', async () => {
    const builder = makeBuilder()
    const from = vi.fn(() => builder)

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as never)

    const { markAsRead } = await import('@/app/actions/notifications')
    await markAsRead('notif-1')

    expect(from).toHaveBeenCalledWith('notifications')
    expect(builder.update).toHaveBeenCalledWith({ is_read: true })
    const eqCalls = builder.calls.filter((c: { method: string }) => c.method === 'eq')
    expect(eqCalls).toEqual([
      { method: 'eq', args: ['id', 'notif-1'] },
      { method: 'eq', args: ['user_id', 'user-1'] },
    ])
  })

  it('no-ops when not authenticated', async () => {
    const from = vi.fn()
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from,
    } as never)

    const { markAsRead } = await import('@/app/actions/notifications')
    await markAsRead('notif-1')

    expect(from).not.toHaveBeenCalled()
  })
})

describe('markAllRead', () => {
  it('updates all unread rows scoped to the current user', async () => {
    const builder = makeBuilder()
    const from = vi.fn(() => builder)

    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from,
    } as never)

    const { markAllRead } = await import('@/app/actions/notifications')
    await markAllRead()

    expect(builder.update).toHaveBeenCalledWith({ is_read: true })
    const eqCalls = builder.calls.filter((c: { method: string }) => c.method === 'eq')
    expect(eqCalls).toEqual([
      { method: 'eq', args: ['user_id', 'user-1'] },
      { method: 'eq', args: ['is_read', false] },
    ])
  })
})
