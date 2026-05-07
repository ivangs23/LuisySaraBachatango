import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithPassword = vi.fn()
const adminDeleteUser = vi.fn()
const signOut = vi.fn().mockResolvedValue({ error: null })
const getUser = vi.fn()
const adminInsertMock = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser, signInWithPassword, signOut },
  }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { deleteUser: adminDeleteUser } },
    from: (table: string) => {
      if (table === 'account_deletions') {
        return { insert: adminInsertMock }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    },
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { deleteAccount } from '@/app/profile/actions'

function fd(entries: Record<string, string>) {
  const f = new FormData()
  Object.entries(entries).forEach(([k, v]) => f.append(k, v))
  return f
}

describe('deleteAccount reauth', () => {
  beforeEach(() => {
    signInWithPassword.mockReset()
    adminDeleteUser.mockReset()
    adminInsertMock.mockReset()
    adminInsertMock.mockResolvedValue({ error: null })
    getUser.mockReset()
    signOut.mockResolvedValue({ error: null })
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } })
  })

  it('redirects to /login when not authenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(deleteAccount(fd({}))).rejects.toThrow('REDIRECT:/login')
    expect(adminDeleteUser).not.toHaveBeenCalled()
  })

  it('throws if password missing', async () => {
    await expect(deleteAccount(fd({}))).rejects.toThrow(/Contraseña requerida/i)
    expect(adminDeleteUser).not.toHaveBeenCalled()
  })

  it('throws if password is empty string', async () => {
    await expect(deleteAccount(fd({ password: '' }))).rejects.toThrow(/Contraseña requerida/i)
    expect(adminDeleteUser).not.toHaveBeenCalled()
  })

  it('throws if password wrong', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'invalid login credentials' } })
    await expect(deleteAccount(fd({ password: 'bad' }))).rejects.toThrow(/Contraseña incorrecta/i)
    expect(adminDeleteUser).not.toHaveBeenCalled()
  })

  it('does not call adminDeleteUser when reauth fails', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'invalid' } })
    await deleteAccount(fd({ password: 'bad' })).catch(() => {})
    expect(adminDeleteUser).not.toHaveBeenCalled()
  })

  it('deletes user when password correct', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    adminDeleteUser.mockResolvedValue({ error: null })
    await expect(deleteAccount(fd({ password: 'good' }))).rejects.toThrow(/REDIRECT:.*account_deleted/)
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'good' })
    expect(adminDeleteUser).toHaveBeenCalledWith('u1')
  })

  it('signs out after successful deletion', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    adminDeleteUser.mockResolvedValue({ error: null })
    await deleteAccount(fd({ password: 'good' })).catch(() => {})
    expect(signOut).toHaveBeenCalled()
  })

  it('throws if admin deleteUser fails', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    adminDeleteUser.mockResolvedValue({ error: { message: 'db error' } })
    await expect(deleteAccount(fd({ password: 'good' }))).rejects.toThrow(/borrar la cuenta/i)
  })

  it('inserts audit record with sha256 of email on successful deletion', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    adminDeleteUser.mockResolvedValue({ error: null })
    await deleteAccount(fd({ password: 'good' })).catch(() => {})
    expect(adminInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ email_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
    )
  })

  it('still deletes user even if audit insert throws', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    adminInsertMock.mockRejectedValue(new Error('db unavailable'))
    adminDeleteUser.mockResolvedValue({ error: null })
    await expect(deleteAccount(fd({ password: 'good' }))).rejects.toThrow(/REDIRECT:.*account_deleted/)
    expect(adminDeleteUser).toHaveBeenCalledWith('u1')
  })
})
