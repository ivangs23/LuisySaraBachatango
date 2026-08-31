import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

const limitMock = vi.fn()
const orderMock = vi.fn(() => ({ limit: limitMock }))
const eqMock = vi.fn(() => ({ eq: eqMock, order: orderMock }))
const selectMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}))

import { getFreeLesson } from '@/utils/courses/free-lesson'

const ROW = {
  id: 'l1',
  title: 'Clase 1',
  description: 'Intro',
  thumbnail_url: null,
  mux_playback_id: 'pb1',
  course_id: 'c1',
}

describe('getFreeLesson', () => {
  beforeEach(() => {
    limitMock.mockReset()
    fromMock.mockClear()
    eqMock.mockClear()
  })

  it('devuelve la primera lección gratuita lista', async () => {
    limitMock.mockResolvedValue({ data: [ROW], error: null })
    expect(await getFreeLesson()).toEqual(ROW)
    expect(fromMock).toHaveBeenCalledWith('lessons')
  })

  it('filtra por is_free y por mux_status ready', async () => {
    limitMock.mockResolvedValue({ data: [ROW], error: null })
    await getFreeLesson()
    expect(eqMock).toHaveBeenCalledWith('is_free', true)
    expect(eqMock).toHaveBeenCalledWith('mux_status', 'ready')
  })

  it('devuelve null cuando no hay ninguna lección gratuita', async () => {
    limitMock.mockResolvedValue({ data: [], error: null })
    expect(await getFreeLesson()).toBeNull()
  })

  it('devuelve null cuando la query falla', async () => {
    limitMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getFreeLesson()).toBeNull()
  })

  it('descarta filas sin mux_playback_id', async () => {
    limitMock.mockResolvedValue({ data: [{ ...ROW, mux_playback_id: null }], error: null })
    expect(await getFreeLesson()).toBeNull()
  })
})
