import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'
const { mockRequireAdmin, mockProfileSingle, mockAuditInsert, mockDeleteUser } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn().mockResolvedValue({ id: 'admin1' }),
  mockProfileSingle: vi.fn().mockResolvedValue({ data: { id: 'u2', email: 'x@y.com' }, error: null }),
  mockAuditInsert: vi.fn().mockResolvedValue({ error: null }),
  mockDeleteUser: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => mockRequireAdmin() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({
  from: (t: string) => t === 'account_deletions'
    ? { insert: mockAuditInsert }
    : { select: () => ({ eq: () => ({ single: mockProfileSingle }) }) },
  auth: { admin: { deleteUser: mockDeleteUser } },
}) }))
import { deleteUser } from '@/app/admin/alumnos/actions'
beforeEach(() => vi.clearAllMocks())

describe('deleteUser audit trail', () => {
  it('writes a hashed-email audit row before deleting', async () => {
    await deleteUser('u2', 'ELIMINAR', 'x@y.com')
    expect(mockAuditInsert).toHaveBeenCalled()
    const row = mockAuditInsert.mock.calls[0][0]
    expect(row.email_sha256).toBe(crypto.createHash('sha256').update('x@y.com').digest('hex'))
    expect(mockDeleteUser).toHaveBeenCalledWith('u2')
  })
})
