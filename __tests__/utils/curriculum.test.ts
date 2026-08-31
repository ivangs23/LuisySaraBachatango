import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

const orderMock = vi.fn()
const eqMock = vi.fn(() => ({ order: orderMock }))
const selectMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}))

import { getCurriculum, formatDuration } from '@/utils/courses/curriculum'

const ROWS = [
  { id: 'm1', title: 'INTRODUCCIÓN', order: 1, parent_lesson_id: null, duration: 300 },
  { id: 'm2', title: 'POSTURAS', order: 2, parent_lesson_id: null, duration: 600 },
  { id: 's1', title: 'POSTURAS — práctica', order: 1, parent_lesson_id: 'm2', duration: 120 },
  { id: 's2', title: 'POSTURAS — repaso', order: 2, parent_lesson_id: 'm2', duration: null },
]

describe('formatDuration', () => {
  it('muestra solo minutos por debajo de una hora', () => {
    expect(formatDuration(300)).toBe('5 min')
    expect(formatDuration(59)).toBe('1 min')
  })

  it('muestra horas y minutos por encima', () => {
    expect(formatDuration(3600)).toBe('1 h')
    expect(formatDuration(3900)).toBe('1 h 5 min')
    expect(formatDuration(7830)).toBe('2 h 11 min')
  })

  it('devuelve cadena vacía si no hay duración', () => {
    expect(formatDuration(0)).toBe('')
  })
})

describe('getCurriculum', () => {
  beforeEach(() => {
    orderMock.mockReset()
    fromMock.mockClear()
  })

  it('agrupa las sublecciones bajo su módulo', async () => {
    orderMock.mockResolvedValue({ data: ROWS, error: null })
    const c = (await getCurriculum())!

    expect(c.moduleCount).toBe(2)
    expect(c.lessonCount).toBe(4)
    expect(c.modules[0].title).toBe('INTRODUCCIÓN')
    expect(c.modules[0].lessons).toHaveLength(0)
    expect(c.modules[1].lessons.map((l) => l.id)).toEqual(['s1', 's2'])
  })

  it('ordena los módulos por `order`', async () => {
    orderMock.mockResolvedValue({ data: [...ROWS].reverse(), error: null })
    const c = (await getCurriculum())!
    expect(c.modules.map((m) => m.order)).toEqual([1, 2])
  })

  it('suma la duración del módulo incluyendo sus sublecciones', async () => {
    orderMock.mockResolvedValue({ data: ROWS, error: null })
    const c = (await getCurriculum())!
    expect(c.modules[0].totalSeconds).toBe(300)
    // 600 del módulo + 120 de la sublección; la de duración nula no suma.
    expect(c.modules[1].totalSeconds).toBe(720)
    expect(c.totalSeconds).toBe(1020)
  })

  it('descarta sublecciones huérfanas en vez de perderlas en silencio', async () => {
    orderMock.mockResolvedValue({
      data: [...ROWS, { id: 'x', title: 'huérfana', order: 1, parent_lesson_id: 'no-existe', duration: 60 }],
      error: null,
    })
    const c = (await getCurriculum())!
    expect(c.lessonCount).toBe(4)
    expect(c.totalSeconds).toBe(1020)
  })

  it('devuelve null si la query falla', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getCurriculum()).toBeNull()
  })

  it('devuelve null si no hay lecciones', async () => {
    orderMock.mockResolvedValue({ data: [], error: null })
    expect(await getCurriculum()).toBeNull()
  })
})
