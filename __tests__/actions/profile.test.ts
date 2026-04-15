import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})
const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate })
const mockGetUser = vi.fn()

function makeClient(userId: string | null = 'user-1') {
  return {
    auth: {
      getUser: mockGetUser.mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: mockFrom,
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.test/avatar.jpg' } }),
      }),
    },
  }
}

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))

describe('updateProfile — URL sanitization', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient() as never)
  })

  it('saves null for http:// social URL', async () => {
    const { updateProfile } = await import('@/app/profile/actions')
    const fd = new FormData()
    fd.set('fullName', 'Test User')
    fd.set('avatarMode', 'url')
    fd.set('avatarUrl', '')
    fd.set('instagram', 'http://instagram.com/user')
    fd.set('facebook', 'https://facebook.com/user')
    fd.set('tiktok', '')
    fd.set('youtube', '')

    await updateProfile(fd)

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.instagram).toBeNull()
    expect(updateCall.facebook).toBe('https://facebook.com/user')
  })

  it('saves null for javascript: social URL', async () => {
    const { updateProfile } = await import('@/app/profile/actions')
    const fd = new FormData()
    fd.set('fullName', 'Test User')
    fd.set('avatarMode', 'url')
    fd.set('avatarUrl', '')
    fd.set('instagram', 'javascript:alert(1)')
    fd.set('facebook', '')
    fd.set('tiktok', '')
    fd.set('youtube', '')

    await updateProfile(fd)

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.instagram).toBeNull()
  })

  it('saves null for empty social URL', async () => {
    const { updateProfile } = await import('@/app/profile/actions')
    const fd = new FormData()
    fd.set('fullName', 'Test User')
    fd.set('avatarMode', 'url')
    fd.set('avatarUrl', '')
    fd.set('instagram', '')
    fd.set('facebook', '')
    fd.set('tiktok', '')
    fd.set('youtube', '')

    await updateProfile(fd)

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.instagram).toBeNull()
    expect(updateCall.facebook).toBeNull()
  })

  it('saves valid https:// URLs for all social fields', async () => {
    const { updateProfile } = await import('@/app/profile/actions')
    const fd = new FormData()
    fd.set('fullName', 'Test User')
    fd.set('avatarMode', 'url')
    fd.set('avatarUrl', '')
    fd.set('instagram', 'https://instagram.com/user')
    fd.set('facebook', 'https://facebook.com/user')
    fd.set('tiktok', 'https://tiktok.com/@user')
    fd.set('youtube', 'https://youtube.com/@user')

    await updateProfile(fd)

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.instagram).toBe('https://instagram.com/user')
    expect(updateCall.facebook).toBe('https://facebook.com/user')
    expect(updateCall.tiktok).toBe('https://tiktok.com/@user')
    expect(updateCall.youtube).toBe('https://youtube.com/@user')
  })

  it('redirects to /login when not authenticated', async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient(null) as never)

    const { updateProfile } = await import('@/app/profile/actions')
    const fd = new FormData()

    await expect(updateProfile(fd)).rejects.toThrow('REDIRECT:/login')
  })
})

describe('updateProfile — avatar file validation', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient() as never)
  })

  it('throws for non-image MIME type', async () => {
    const { updateProfile } = await import('@/app/profile/actions')

    const mockFile = new File(['content'], 'virus.exe', { type: 'application/octet-stream' })
    Object.defineProperty(mockFile, 'size', { value: 1024 })

    const fd = new FormData()
    fd.set('fullName', 'Test User')
    fd.set('avatarMode', 'upload')
    fd.set('avatarFile', mockFile)

    await expect(updateProfile(fd)).rejects.toThrow('Tipo de archivo no permitido')
  })

  it('throws for file exceeding 5MB', async () => {
    const { updateProfile } = await import('@/app/profile/actions')

    const mockFile = new File(['content'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(mockFile, 'size', { value: 6 * 1024 * 1024 })

    const fd = new FormData()
    fd.set('fullName', 'Test User')
    fd.set('avatarMode', 'upload')
    fd.set('avatarFile', mockFile)

    await expect(updateProfile(fd)).rejects.toThrow('demasiado grande')
  })
})
