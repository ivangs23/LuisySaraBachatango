import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { fillCurriculum, heroSub } from '@/app/curso-bachatango/_lib/curriculum-copy'
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import { LOCALES } from '@/utils/i18n/types'
import type { Curriculum } from '@/utils/courses/curriculum'

const TEMARIO: Curriculum = { modules: [], moduleCount: 14, lessonCount: 28, totalSeconds: 7920 }

// Espacio de no separación: la duración va como un bloque («2 h 12 min»).
const NBSP = String.fromCharCode(0xa0)
const DURACION = `2${NBSP}h${NBSP}12${NBSP}min`

describe('fillCurriculum', () => {
  it('rellena módulos, lecciones y duración con el temario real', () => {
    expect(fillCurriculum('{modules} módulos · {lessons} lecciones · {duration}', TEMARIO))
      .toBe(`14 módulos · 28 lecciones · ${DURACION}`)
  })

  // En el hero a 390 px la línea se partía entre «2» y «h 12 min».
  it('la duración nunca se parte entre líneas', () => {
    const texto = fillCurriculum('{duration}', TEMARIO)!
    expect(texto).toBe(DURACION)
    expect(texto).not.toMatch(/ /)
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

describe('heroSub', () => {
  it('lleva las cifras reales del temario', () => {
    expect(heroSub(getLandingCopy('es'), TEMARIO)).toBe(
      `14 módulos, 28 lecciones en vídeo, ${DURACION}. Aprendes el rol de leader y el de follower, así que puedes empezar sin pareja.`,
    )
  })

  it('sin temario cae a un subtítulo sin cifras, en los seis idiomas', () => {
    for (const locale of LOCALES) {
      const copy = getLandingCopy(locale)
      const sub = heroSub(copy, null)
      expect(sub, locale).toBe(copy.hero.subFallback)
      expect(sub, locale).not.toMatch(/[{}\d]/)
    }
  })
})
