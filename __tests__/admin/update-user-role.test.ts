import { describe, it, expect, vi, beforeEach } from 'vitest'

// El guard de "último admin" es ahora ATÓMICO dentro de la función SQL
// set_user_role (bloquea las filas admin con FOR UPDATE), invocada por rpc
// (AUDITORIA-2026-07 B8). Aquí se testea el contrato del server action:
// bloqueo de auto-rol, delegación a la rpc, y mapeo del error last_admin.
const { mockRequireAdmin, mockRpc } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockRpc: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => mockRequireAdmin() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }),
}))
import { updateUserRole } from '@/app/admin/alumnos/actions'
beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'admin1' })
  mockRpc.mockResolvedValue({ error: null })
})

describe('updateUserRole guardrails', () => {
  it('blocks changing your OWN role', async () => {
    await expect(updateUserRole('admin1', 'member')).rejects.toThrow(/tu propio rol/)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('delega en la función atómica set_user_role', async () => {
    await updateUserRole('other-admin', 'member')
    expect(mockRpc).toHaveBeenCalledWith('set_user_role', { target: 'other-admin', new_role: 'member' })
  })

  it('mapea el error last_admin (raise del guard SQL) al mensaje en español', async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: 'last_admin' } })
    await expect(updateUserRole('other-admin', 'member')).rejects.toThrow(/último admin/)
  })

  it('propaga otros errores de la rpc', async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: 'db down' } })
    await expect(updateUserRole('u2', 'premium')).rejects.toThrow()
  })

  it('promover a admin también pasa por la rpc', async () => {
    await updateUserRole('u3', 'admin')
    expect(mockRpc).toHaveBeenCalledWith('set_user_role', { target: 'u3', new_role: 'admin' })
  })
})
