import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSet, mockDelete, mockRevalidate, mockRequireAdmin } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockDelete: vi.fn(),
  mockRevalidate: vi.fn(),
  mockRequireAdmin: vi.fn().mockResolvedValue({ id: 'admin1' }),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ set: mockSet, delete: mockDelete }) }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidate }))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => mockRequireAdmin() }))

import { enableTestMode, disableTestMode } from '@/app/admin/pruebas/actions'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TEST_MODE_SECRET = 'unit-test-secret'
  mockRequireAdmin.mockResolvedValue({ id: 'admin1' })
})

describe('enableTestMode', () => {
  it('admin: setea lsb_test_mode con opciones seguras + revalida layout', async () => {
    await enableTestMode()
    expect(mockRequireAdmin).toHaveBeenCalled()
    const [name, value, opts] = mockSet.mock.calls[0]
    expect(name).toBe('lsb_test_mode')
    expect(typeof value).toBe('string')
    expect(value).toMatch(/^\d+\./)
    expect(opts).toEqual(expect.objectContaining({
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7200,
    }))
    expect(mockRevalidate).toHaveBeenCalledWith('/', 'layout')
  })
  it('no-admin (requireAdmin lanza): no setea cookie', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('forbidden'))
    await expect(enableTestMode()).rejects.toThrow()
    expect(mockSet).not.toHaveBeenCalled()
  })
  it('sin secreto: lanza y no setea cookie', async () => {
    delete process.env.TEST_MODE_SECRET
    await expect(enableTestMode()).rejects.toThrow()
    expect(mockSet).not.toHaveBeenCalled()
  })
})

describe('disableTestMode', () => {
  it('admin: borra la cookie + revalida layout', async () => {
    await disableTestMode()
    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(mockDelete).toHaveBeenCalledWith({ name: 'lsb_test_mode', path: '/' })
    expect(mockRevalidate).toHaveBeenCalledWith('/', 'layout')
  })
  it('no-admin: no borra cookie', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('forbidden'))
    await expect(disableTestMode()).rejects.toThrow()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
