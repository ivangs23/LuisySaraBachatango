import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockRequireAdmin = vi.fn()
vi.mock('@/utils/admin/guard', () => ({
  requireAdmin: () => mockRequireAdmin(),
  AdminGuardError: class extends Error { constructor(public reason: string) { super(reason) } },
}))

const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockDeleteUser = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          update: mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          insert: mockInsert.mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockSingle }),
          }),
        }
      }
      return {
        update: mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        insert: mockInsert.mockResolvedValue({ error: null }),
      }
    }),
    auth: { admin: { deleteUser: mockDeleteUser.mockResolvedValue({ error: null }) } },
  }),
}))

describe('updateUserRole', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRequireAdmin.mockResolvedValue({ id: 'admin-1' }) })

  it('updates role when admin', async () => {
    const { updateUserRole } = await import('@/app/admin/alumnos/actions')
    await updateUserRole('user-1', 'premium')
    expect(mockUpdate).toHaveBeenCalledWith({ role: 'premium' })
  })

  it('rejects invalid role', async () => {
    const { updateUserRole } = await import('@/app/admin/alumnos/actions')
    // @ts-expect-error testing invalid role
    await expect(updateUserRole('u1', 'super')).rejects.toThrow()
  })

  it('throws when not admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const { updateUserRole } = await import('@/app/admin/alumnos/actions')
    await expect(updateUserRole('u1', 'admin')).rejects.toThrow()
  })
})

describe('grantCourseAccess', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRequireAdmin.mockResolvedValue({ id: 'admin-1' }) })

  it('inserts a course_purchases row with manual session id', async () => {
    const { grantCourseAccess } = await import('@/app/admin/alumnos/actions')
    await grantCourseAccess('u1', 'c1')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', course_id: 'c1', amount_paid: 0,
    }))
    const arg = mockInsert.mock.calls[0][0]
    expect(arg.stripe_session_id).toMatch(/^manual_admin_/)
  })
})

describe('sendNotification', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRequireAdmin.mockResolvedValue({ id: 'admin-1' }) })

  it('inserts notification', async () => {
    const { sendNotification } = await import('@/app/admin/alumnos/actions')
    await sendNotification('u1', 'Hola', 'Mensaje')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', title: 'Hola', body: 'Mensaje', type: 'admin_message',
    }))
  })

  it('rejects empty title', async () => {
    const { sendNotification } = await import('@/app/admin/alumnos/actions')
    await expect(sendNotification('u1', '   ', 'b')).rejects.toThrow()
  })
})

describe('deleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' })
    mockSingle.mockResolvedValue({ data: { id: 'u1', email: 'target@example.com' }, error: null })
  })

  it('calls supabase auth admin deleteUser when phrase and email are correct', async () => {
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await deleteUser('u1', 'ELIMINAR', 'target@example.com')
    expect(mockDeleteUser).toHaveBeenCalledWith('u1')
  })

  it('accepts email with different casing', async () => {
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await deleteUser('u1', 'ELIMINAR', 'TARGET@EXAMPLE.COM')
    expect(mockDeleteUser).toHaveBeenCalledWith('u1')
  })

  it('accepts email with surrounding whitespace', async () => {
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await deleteUser('u1', 'ELIMINAR', '  target@example.com  ')
    expect(mockDeleteUser).toHaveBeenCalledWith('u1')
  })

  it('rejects without typed-confirm phrase', async () => {
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await expect(deleteUser('u1', 'eliminar', 'target@example.com')).rejects.toThrow('Confirmation phrase required')
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('rejects when targetEmail is missing', async () => {
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await expect(deleteUser('u1', 'ELIMINAR', '')).rejects.toThrow('Email del usuario requerido')
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('rejects when targetEmail does not match the user', async () => {
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await expect(deleteUser('u1', 'ELIMINAR', 'wrong@example.com')).rejects.toThrow('El email no coincide')
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('rejects when user is not found in profiles', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await expect(deleteUser('u1', 'ELIMINAR', 'target@example.com')).rejects.toThrow('Usuario no encontrado')
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('refuses to delete the calling admin', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ id: 'me' })
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await expect(deleteUser('me', 'ELIMINAR', 'target@example.com')).rejects.toThrow('Cannot delete yourself')
  })
})
