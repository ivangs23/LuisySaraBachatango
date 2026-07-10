import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRedirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
const mockRevalidatePath = vi.fn()
const mockGetUser = vi.fn()
const mockUpdateUser = vi.fn()

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
// '@/app/reset-password/actions' imports MIN_PASSWORD_LENGTH from
// '@/app/login/actions', which transitively imports next/headers and
// rate-limit helpers — mock those so the import chain resolves cleanly.
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}))
vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
  rateLimitKey: vi.fn((...args: unknown[]) => args.join(':')),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  }),
}))

// Helper to read redirect destination from thrown error
function getRedirectUrl(err: unknown): string {
  if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
    return err.message.replace('REDIRECT:', '')
  }
  throw err
}

describe('updatePassword action', () => {
  beforeEach(() => vi.clearAllMocks())

  it('valid password: updates the user and redirects to /dashboard', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockUpdateUser.mockResolvedValueOnce({ error: null })
    const { updatePassword } = await import('@/app/reset-password/actions')

    const fd = new FormData()
    fd.set('password', 'longenough1')

    const url = await updatePassword(fd).catch(getRedirectUrl)

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'longenough1' })
    expect(url).toBe('/dashboard')
  })

  it('too-short password: redirects with error and does NOT call updateUser', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    const { updatePassword } = await import('@/app/reset-password/actions')

    const fd = new FormData()
    fd.set('password', 'short')

    const url = await updatePassword(fd).catch(getRedirectUrl)

    expect(url).toBe('/reset-password?error=password_too_short')
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('no active session: redirects to /login', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { updatePassword } = await import('@/app/reset-password/actions')

    const fd = new FormData()
    fd.set('password', 'longenough1')

    const url = await updatePassword(fd).catch(getRedirectUrl)

    expect(url).toBe('/login')
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('updateUser error: redirects with update_failed error', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockUpdateUser.mockResolvedValueOnce({ error: new Error('boom') })
    const { updatePassword } = await import('@/app/reset-password/actions')

    const fd = new FormData()
    fd.set('password', 'longenough1')

    const url = await updatePassword(fd).catch(getRedirectUrl)

    expect(url).toBe('/reset-password?error=update_failed')
  })
})
