import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: 'admin' }) }))

const gteMock = vi.fn()
const selectMock = vi.fn(() => ({ gte: gteMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({ from: fromMock }) }))

import { getLandingFunnel, getLandingTraffic } from '@/utils/admin/landing-queries'

/** 3 visitantes en la home, 2 llegan a venta, 1 compra. */
const ROWS = [
  { path: '/', visitor_hash: 'a', created_at: '2026-08-10T10:00:00Z' },
  { path: '/', visitor_hash: 'b', created_at: '2026-08-10T11:00:00Z' },
  { path: '/', visitor_hash: 'c', created_at: '2026-08-11T10:00:00Z' },
  { path: '/', visitor_hash: 'a', created_at: '2026-08-10T12:00:00Z' }, // repetida
  { path: '/curso-bachatango', visitor_hash: 'a', created_at: '2026-08-10T10:05:00Z' },
  { path: '/curso-bachatango', visitor_hash: 'b', created_at: '2026-08-10T11:05:00Z' },
  { path: '/curso-bachatango/comprar', visitor_hash: 'a', created_at: '2026-08-10T10:10:00Z' },
  { path: '/gracias', visitor_hash: 'a', created_at: '2026-08-10T10:12:00Z' },
]

beforeEach(() => {
  gteMock.mockReset().mockResolvedValue({ data: ROWS, error: null })
  fromMock.mockClear()
})

describe('getLandingFunnel', () => {
  it('cuenta únicos por paso', async () => {
    const f = await getLandingFunnel(90)
    expect(f.map(s => s.visitors)).toEqual([3, 2, 1, 1])
  })

  it('calcula el porcentaje que pasa al siguiente paso', async () => {
    const f = await getLandingFunnel(90)
    expect(f[0].dropFromPrev).toBeNull()
    expect(f[1].dropFromPrev).toBeCloseTo(66.67, 1)
    expect(f[2].dropFromPrev).toBeCloseTo(50, 1)
    expect(f[3].dropFromPrev).toBeCloseTo(100, 1)
  })

  it('no divide por cero cuando un paso está vacío', async () => {
    gteMock.mockResolvedValue({ data: [{ path: '/gracias', visitor_hash: 'z', created_at: '2026-08-10T10:00:00Z' }], error: null })
    const f = await getLandingFunnel(90)
    expect(f[0].visitors).toBe(0)
    expect(f[1].dropFromPrev).toBeNull()
    expect(Number.isFinite(f[3].visitors)).toBe(true)
  })

  it('devuelve los pasos aunque no haya datos', async () => {
    gteMock.mockResolvedValue({ data: [], error: null })
    const f = await getLandingFunnel(90)
    expect(f).toHaveLength(4)
    expect(f.every(s => s.visitors === 0)).toBe(true)
  })

  it('devuelve los pasos a cero si la query falla', async () => {
    gteMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const f = await getLandingFunnel(90)
    expect(f).toHaveLength(4)
    expect(f.every(s => s.visitors === 0)).toBe(true)
  })
})

describe('getLandingTraffic', () => {
  it('agrupa vistas y únicos por día', async () => {
    const t = await getLandingTraffic(90)
    // El 10 tiene 7 eventos (4 de 'a', 2 de 'b' y el /gracias de 'a') de 2
    // visitantes; el 11 tiene 1 evento de 'c'.
    expect(t).toEqual([
      { date: '2026-08-10', views: 7, uniques: 2 },
      { date: '2026-08-11', views: 1, uniques: 1 },
    ])
  })

  it('devuelve vacío si la query falla', async () => {
    gteMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getLandingTraffic(90)).toEqual([])
  })
})
