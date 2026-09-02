import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const requireAdminMock = vi.fn().mockResolvedValue({ id: 'admin' })
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => requireAdminMock() }))

const gteMock = vi.fn()
const selectMock = vi.fn(() => ({ gte: gteMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({ from: fromMock }) }))

import { getOnlineNow, ONLINE_WINDOW_MS } from '@/utils/admin/presence-queries'

beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue({ id: 'admin' })
  gteMock.mockReset().mockResolvedValue({ count: 7, error: null })
  fromMock.mockClear()
  selectMock.mockClear()
})

describe('getOnlineNow', () => {
  it('devuelve el número de visitantes de la ventana', async () => {
    expect(await getOnlineNow()).toBe(7)
    expect(fromMock).toHaveBeenCalledWith('online_pings')
  })

  it('exige admin ANTES de tocar la base de datos', async () => {
    requireAdminMock.mockRejectedValue(new Error('AdminGuard: forbidden'))
    await expect(getOnlineNow()).rejects.toThrow('AdminGuard: forbidden')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('cuenta con head: no se trae ni un hash de visitante', async () => {
    await getOnlineNow()
    expect(selectMock).toHaveBeenCalledWith('visitor_hash', { count: 'exact', head: true })
  })

  it('recorta por la ventana de presencia', async () => {
    const before = Date.now()
    await getOnlineNow()
    const [column, cutoffIso] = gteMock.mock.calls[0] as [string, string]
    expect(column).toBe('last_seen')
    const cutoff = Date.parse(cutoffIso)
    expect(cutoff).toBeGreaterThanOrEqual(before - ONLINE_WINDOW_MS - 1000)
    expect(cutoff).toBeLessThanOrEqual(Date.now() - ONLINE_WINDOW_MS + 1000)
  })

  it('devuelve 0 si la consulta falla', async () => {
    gteMock.mockResolvedValue({ count: null, error: { message: 'boom' } })
    expect(await getOnlineNow()).toBe(0)
  })

  it('devuelve 0 cuando no hay nadie', async () => {
    gteMock.mockResolvedValue({ count: null, error: null })
    expect(await getOnlineNow()).toBe(0)
  })
})
