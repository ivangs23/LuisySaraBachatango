import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks must be declared before any module imports ────────────────────────
// Use vi.hoisted so that top-level variables referenced inside vi.mock factories
// are available at hoist-time (before module evaluation).

const { mockRequireAdmin, mockRevalidatePath, mockDeleteEq, mockDelete, mockFrom } = vi.hoisted(() => {
  const mockDeleteEq = vi.fn()
  const mockDelete = vi.fn()
  const mockFrom = vi.fn()
  return {
    mockRequireAdmin: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockDeleteEq,
    mockDelete,
    mockFrom,
  }
})

vi.mock('server-only', () => ({}))

vi.mock('@/utils/auth/require-admin', () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

// createSupabaseAdmin returns a synchronous client (no await).
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// ─── Import under test ────────────────────────────────────────────────────────
import { deletePost, deleteComment } from '@/app/admin/comunidad/actions'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('admin/comunidad actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })

    mockDeleteEq.mockResolvedValue({ error: null })
    mockDelete.mockReturnValue({ eq: mockDeleteEq })
    mockFrom.mockReturnValue({ delete: mockDelete })
  })

  // ── deletePost ──────────────────────────────────────────────────────────────

  describe('deletePost', () => {
    it('throws when requireAdmin rejects (non-admin)', async () => {
      mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
      await expect(deletePost('p1')).rejects.toThrow('forbidden')
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('throws when postId is empty string', async () => {
      await expect(deletePost('')).rejects.toThrow('postId required')
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('deletes the post by id and revalidates path', async () => {
      await deletePost('post-123')

      expect(mockFrom).toHaveBeenCalledWith('posts')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockDeleteEq).toHaveBeenCalledWith('id', 'post-123')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/comunidad')
    })

    it('throws when Supabase delete returns an error', async () => {
      const dbError = new Error('delete failed')
      mockDeleteEq.mockResolvedValueOnce({ error: dbError })

      await expect(deletePost('p1')).rejects.toThrow('delete failed')
    })
  })

  // ── deleteComment ───────────────────────────────────────────────────────────

  describe('deleteComment', () => {
    it('throws when requireAdmin rejects (non-admin)', async () => {
      mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
      await expect(deleteComment('c1')).rejects.toThrow('forbidden')
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('throws when commentId is empty string', async () => {
      await expect(deleteComment('')).rejects.toThrow('commentId required')
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('deletes the comment by id and revalidates path', async () => {
      await deleteComment('comment-456')

      expect(mockFrom).toHaveBeenCalledWith('comments')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockDeleteEq).toHaveBeenCalledWith('id', 'comment-456')
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/comunidad')
    })

    it('throws when Supabase delete returns an error', async () => {
      const dbError = new Error('delete failed')
      mockDeleteEq.mockResolvedValueOnce({ error: dbError })

      await expect(deleteComment('c1')).rejects.toThrow('delete failed')
    })
  })
})
