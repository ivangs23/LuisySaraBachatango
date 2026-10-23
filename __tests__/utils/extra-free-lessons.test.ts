import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const eqStatusMock = vi.fn()
const eqCourseMock = vi.fn(() => ({ eq: eqStatusMock }))
const inMock = vi.fn(() => ({ eq: eqCourseMock }))
const selectMock = vi.fn(() => ({ in: inMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({ from: fromMock }) }))

import { getExtraFreeLessons, EXTRA_FREE_LESSON_IDS } from '@/utils/courses/extra-free-lessons'
import { COURSE_ID } from '@/utils/courses/landing-course'

const [POSTURAS, CUADRADO] = EXTRA_FREE_LESSON_IDS

describe('getExtraFreeLessons', () => {
  beforeEach(() => {
    eqStatusMock.mockReset()
    inMock.mockClear()
    eqCourseMock.mockClear()
  })

  // D4 (2026-10-23): las dos clases que se mandan por email.
  it('son POSTURAS y SEGUNDO BÁSICO - CUADRADO', () => {
    expect(EXTRA_FREE_LESSON_IDS).toEqual([
      '3597aa87-27de-480b-899a-7a7880b27ce4',
      'd4a5eed2-3c2c-497c-af48-fbef072c98f2',
    ])
  })

  it('pide solo esas lecciones, de este curso y con el vídeo listo', async () => {
    eqStatusMock.mockResolvedValue({ data: [], error: null })
    await getExtraFreeLessons()
    expect(fromMock).toHaveBeenCalledWith('lessons')
    expect(inMock).toHaveBeenCalledWith('id', EXTRA_FREE_LESSON_IDS)
    expect(eqCourseMock).toHaveBeenCalledWith('course_id', COURSE_ID)
    expect(eqStatusMock).toHaveBeenCalledWith('mux_status', 'ready')
  })

  it('las devuelve en el orden del curso, no en el de la BD', async () => {
    eqStatusMock.mockResolvedValue({
      data: [
        { id: CUADRADO, title: 'SEGUNDO BÁSICO - CUADRADO', description: null, mux_playback_id: 'pb2' },
        { id: POSTURAS, title: 'POSTURAS', description: null, mux_playback_id: 'pb1' },
      ],
      error: null,
    })
    expect((await getExtraFreeLessons()).map((l) => l.title)).toEqual(['POSTURAS', 'SEGUNDO BÁSICO - CUADRADO'])
  })

  it('descarta las que no tienen vídeo', async () => {
    eqStatusMock.mockResolvedValue({
      data: [{ id: POSTURAS, title: 'POSTURAS', description: null, mux_playback_id: null }],
      error: null,
    })
    expect(await getExtraFreeLessons()).toEqual([])
  })

  it('devuelve una lista vacía si la BD falla', async () => {
    eqStatusMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getExtraFreeLessons()).toEqual([])
  })
})
