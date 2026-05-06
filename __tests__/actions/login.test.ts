import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRedirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
const mockRevalidatePath = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignUp = vi.fn()
const mockResetPasswordForEmail = vi.fn()

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      resetPasswordForEmail: mockResetPasswordForEmail,
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

describe('login action', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects to /dashboard on successful login', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null })
    const { login } = await import('@/app/login/actions')

    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('password', 'password123')

    const url = await login(fd).catch(getRedirectUrl)
    expect(url).toBe('/dashboard')
  })

  it('redirects to /login?error=invalid_credentials on auth failure', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: new Error('Invalid credentials') })
    const { login } = await import('@/app/login/actions')

    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('password', 'wrong-password')

    const url = await login(fd).catch(getRedirectUrl)
    expect(url).toBe('/login?error=invalid_credentials')
  })

  it('does NOT expose raw Supabase error messages', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: new Error('User not found in auth.users'),
    })
    const { login } = await import('@/app/login/actions')

    const fd = new FormData()
    fd.set('email', 'x@x.com')
    fd.set('password', 'x')

    const url = await login(fd).catch(getRedirectUrl)
    expect(url).not.toContain('User not found')
    expect(url).not.toContain('auth.users')
  })
})

describe('signup action', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects to email confirmation message on success', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null })
    const { signup } = await import('@/app/login/actions')

    const fd = new FormData()
    fd.set('email', 'new@example.com')
    fd.set('password', 'securePassword1!')
    fd.set('fullName', 'Test User')

    const url = await signup(fd).catch(getRedirectUrl)
    expect(url).toContain('/login')
    expect(url).toContain('message')
  })

  it('redirects to /login?error=signup_failed on error', async () => {
    mockSignUp.mockResolvedValueOnce({ error: new Error('Email already exists') })
    const { signup } = await import('@/app/login/actions')

    const fd = new FormData()
    fd.set('email', 'existing@example.com')
    fd.set('password', 'password123')
    fd.set('fullName', 'Existing User')

    const url = await signup(fd).catch(getRedirectUrl)
    expect(url).toBe('/login?error=signup_failed')
  })

  it('does NOT expose account existence in error message', async () => {
    mockSignUp.mockResolvedValueOnce({ error: new Error('Email already exists') })
    const { signup } = await import('@/app/login/actions')

    const fd = new FormData()
    fd.set('email', 'x@x.com')
    fd.set('password', 'x')
    fd.set('fullName', 'x')

    const url = await signup(fd).catch(getRedirectUrl)
    expect(url).not.toContain('already exists')
  })
})

describe('resetPassword action', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects to success message on valid email', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null })
    const { resetPassword } = await import('@/app/login/actions')

    const fd = new FormData()
    fd.set('email', 'user@example.com')

    const url = await resetPassword(fd).catch(getRedirectUrl)
    expect(url).toContain('/login')
    expect(url).toContain('message')
  })

  it('redirects to same destination on error to prevent account enumeration', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: new Error('User not found') })
    const { resetPassword } = await import('@/app/login/actions')

    const fd = new FormData()
    fd.set('email', 'noone@example.com')

    const url = await resetPassword(fd).catch(getRedirectUrl)
    // Should redirect to the same success URL regardless of whether email exists
    expect(url).toBe('/login?message=email_reset')
  })
})
