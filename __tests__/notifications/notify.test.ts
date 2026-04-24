import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockAdminClient = { rpc: mockRpc }

vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: vi.fn(() => mockAdminClient),
}))

beforeEach(() => {
  mockRpc.mockReset()
  mockRpc.mockResolvedValue({ data: null, error: null })
})

describe('notify()', () => {
  it('skips when actor === recipient (no self-notify)', async () => {
    const { notify } = await import('@/utils/notifications/server')
    await notify({
      recipientId: 'user-1',
      actorId: 'user-1',
      type: 'comment_like',
      entityType: 'comment',
      entityId: 'comment-1',
      link: '/x',
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls upsert_notification RPC with mapped params', async () => {
    const { notify } = await import('@/utils/notifications/server')
    await notify({
      recipientId: 'user-1',
      actorId: 'user-2',
      type: 'comment_like',
      entityType: 'comment',
      entityId: 'comment-1',
      link: '/courses/c/lessons/l#comment-comment-1',
    })
    expect(mockRpc).toHaveBeenCalledWith('upsert_notification', {
      recipient_id: 'user-1',
      actor_id: 'user-2',
      n_type: 'comment_like',
      ent_type: 'comment',
      ent_id: 'comment-1',
      n_link: '/courses/c/lessons/l#comment-comment-1',
    })
  })
})
