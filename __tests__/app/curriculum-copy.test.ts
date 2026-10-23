import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { fillCurriculum } from '@/app/curso-bachatango/_lib/curriculum-copy'
import type { Curriculum } from '@/utils/courses/curriculum'

const TEMARIO: Curriculum = { modules: [], moduleCount: 14, lessonCount: 28, totalSeconds: 7920 }

describe('fillCurriculum', () => {
  it('rellena módulos, lecciones y duración con el temario real', () => {
    expect(fillCurriculum('{modules} módulos · {lessons} lecciones · {duration}', TEMARIO))
      .toBe('14 módulos · 28 lecciones · 2 h 12 min')
  })

  it('sustituye un marcador aunque aparezca dos veces', () => {
    expect(fillCurriculum('{lessons} y {lessons}', TEMARIO)).toBe('28 y 28')
  })

  it('devuelve el texto tal cual si no lleva marcadores, haya temario o no', () => {
    expect(fillCurriculum('Pago seguro', TEMARIO)).toBe('Pago seguro')
    expect(fillCurriculum('Pago seguro', null)).toBe('Pago seguro')
  })

  // Con la BD caída no hay cifras. Mejor quitar el texto que enseñar
  // «{lessons} lecciones» a un visitante.
  it('devuelve null si el texto necesita el temario y no lo hay', () => {
    expect(fillCurriculum('{lessons} lecciones', null)).toBeNull()
  })

  it('devuelve null si pide la duración y el curso no tiene ninguna', () => {
    expect(fillCurriculum('{duration} en total', { ...TEMARIO, totalSeconds: 0 })).toBeNull()
  })
})
