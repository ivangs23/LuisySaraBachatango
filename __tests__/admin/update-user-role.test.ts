import { describe, it, expect, vi, beforeEach } from 'vitest'
const { mockRequireAdmin, mockUpdateEq, state } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockUpdateEq: vi.fn().mockResolvedValue({ error: null }),
  state: { targetRole: 'member', adminCount: 2 },
}))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => mockRequireAdmin() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({
    from: () => ({
      select: (_col: string, opts?: { count?: string }) =>
        opts?.count
          ? { eq: () => Promise.resolve({ count: state.adminCount }) }          // count query
          : { eq: () => ({ single: () => Promise.resolve({ data: { role: state.targetRole } }) }) }, // current-role query
      update: () => ({ eq: mockUpdateEq }),
    }),
  }),
}))
import { updateUserRole } from '@/app/admin/alumnos/actions'
beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'admin1' })
  state.targetRole = 'member'
  state.adminCount = 2
})

describe('updateUserRole guardrails', () => {
  it('blocks changing your OWN role', async () => {
    await expect(updateUserRole('admin1', 'member')).rejects.toThrow(/tu propio rol/)
    expect(mockUpdateEq).not.toHaveBeenCalled()
  })
  it('blocks demoting the LAST admin', async () => {
    state.targetRole = 'admin'; state.adminCount = 1
    await expect(updateUserRole('other-admin', 'member')).rejects.toThrow(/último admin/)
    expect(mockUpdateEq).not.toHaveBeenCalled()
  })
  it('allows demoting an admin when another admin remains', async () => {
    state.targetRole = 'admin'; state.adminCount = 2
    await updateUserRole('other-admin', 'member')
    expect(mockUpdateEq).toHaveBeenCalled()
  })
  it('allows re-roling a non-admin even when only one admin exists (not over-blocked)', async () => {
    state.targetRole = 'member'; state.adminCount = 1
    await updateUserRole('u2', 'premium')
    expect(mockUpdateEq).toHaveBeenCalled()
  })
  it('allows promoting to admin without a count check', async () => {
    state.adminCount = 1
    await updateUserRole('u3', 'admin')
    expect(mockUpdateEq).toHaveBeenCalled()
  })
})
