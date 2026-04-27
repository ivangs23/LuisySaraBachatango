import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))

const mockGetUser = vi.fn()
const mockMaybeSingle = vi.fn()
const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

function makeClient(user: { id: string } | null) {
  return {
    auth: { getUser: mockGetUser.mockResolvedValue({ data: { user } }) },
    from: mockFrom,
  }
}

describe('requireAdmin', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient({ id: 'u1' }) as never)
  })

  it('returns the user when role is admin', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
    const { requireAdmin } = await import('@/utils/admin/guard')
    const u = await requireAdmin()
    expect(u.id).toBe('u1')
  })

  it('throws AdminGuardError when role is member', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: 'member' }, error: null })
    const { requireAdmin, AdminGuardError } = await import('@/utils/admin/guard')
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminGuardError)
  })

  it('throws AdminGuardError when role is premium', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: 'premium' }, error: null })
    const { requireAdmin, AdminGuardError } = await import('@/utils/admin/guard')
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminGuardError)
  })

  it('throws AdminGuardError when no user is logged in', async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce(makeClient(null) as never)
    const { requireAdmin, AdminGuardError } = await import('@/utils/admin/guard')
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminGuardError)
  })

  it('throws AdminGuardError when profile lookup errors', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db' } })
    const { requireAdmin, AdminGuardError } = await import('@/utils/admin/guard')
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminGuardError)
  })

  it('throws AdminGuardError when no profile row is visible (RLS-filtered)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const { requireAdmin, AdminGuardError } = await import('@/utils/admin/guard')
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminGuardError)
  })
})
