import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El precio de la landing pasa a estar cacheado. Si editar el curso no
 * invalidara esa caché, la landing podría anunciar 119 € durante cinco
 * minutos mientras el checkout cobra 129: el precio de Stripe sale de una
 * lectura fresca en comprar/actions.ts:85, no de aquí.
 *
 * Este test fija el contrato entre quien cachea y quien invalida.
 */
function leer(ruta: string): string {
  return readFileSync(join(process.cwd(), ruta), 'utf8')
}

const ACTIONS = leer('app/courses/actions.ts')

describe('etiquetas de caché de la landing', () => {
  it('landing-course.ts etiqueta su caché', () => {
    expect(leer('utils/courses/landing-course.ts')).toContain("'landing-course'")
  })

  it('curriculum.ts etiqueta su caché', () => {
    expect(leer('utils/courses/curriculum.ts')).toContain("'landing-curriculum'")
  })

  it('free-lesson.ts etiqueta su caché', () => {
    expect(leer('utils/courses/free-lesson.ts')).toContain("'landing-free-lesson'")
  })

  it('al editar un curso se invalidan las tres', () => {
    expect(ACTIONS).toContain("revalidateTag('landing-course'")
    expect(ACTIONS).toContain("revalidateTag('landing-curriculum'")
    expect(ACTIONS).toContain("revalidateTag('landing-free-lesson'")
  })
})
