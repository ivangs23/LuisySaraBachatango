// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// CourseCurriculum importa `formatDuration` de un módulo server-only.
vi.mock('server-only', () => ({}))
// El formulario de clases por email tiene su propio test (landing-free-email).
vi.mock('@/components/FreeClassesForm', () => ({ default: () => null, FREE_CLASSES_ANCHOR: 'clases-por-email' }))
import { render, screen } from '@testing-library/react'
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import LandingSections from '@/app/curso-bachatango/_components/LandingSections'
import { buildOffer } from '@/utils/courses/offer'
import { LOCALES } from '@/utils/i18n/types'
import type { Curriculum } from '@/utils/courses/curriculum'
import type { Testimonial } from '@/utils/landing/content'

const COPY = getLandingCopy('es')
const TEMARIO: Curriculum = { modules: [], moduleCount: 14, lessonCount: 28, totalSeconds: 7920 }
const TESTIMONIOS: Testimonial[] = [{ id: 'a', name: 'Ana', quote: 'Muy claro.', stars: 5 }]

function titulos(testimonials: Testimonial[]) {
  render(
    <LandingSections
      copy={COPY}
      courseId="c1"
      offer={buildOffer({ price_eur: 119 })}
      curriculum={TEMARIO}
      freeClass={null}
      testimonials={testimonials}
    />,
  )
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
}

// Orden pensado para alguien que no conoce a Luis y Sara y llega de un
// anuncio: primero por qué fiarse (autoridad, alumnos), luego probarlo gratis,
// después qué hay dentro y cuánto cuesta.
describe('LandingSections · orden para tráfico frío', () => {
  it('autoridad → testimonios → clase gratis → temario → método → oferta → FAQ → CTA', () => {
    expect(titulos(TESTIMONIOS)).toEqual([
      'Quiénes son Luis y Sara',
      'Lo que dicen sus alumnos',
      'Empieza sin riesgo',
      'Qué vas a aprender',
      'El método Luis y Sara',
      'CURSO BACHATANGO completo',
      'Preguntas frecuentes',
      'Empieza hoy con la lección 1',
    ])
  })

  it('sin testimonios, la clase gratis sigue justo después de la autoridad', () => {
    expect(titulos([]).slice(0, 2)).toEqual(['Quiénes son Luis y Sara', 'Empieza sin riesgo'])
  })

  it('ya no pinta el bloque de dolor', () => {
    expect(titulos(TESTIMONIOS)).not.toContain('¿Te suena esto?')
  })

  it('el bloque de dolor desaparece del copy en los seis idiomas', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(getLandingCopy(locale)), locale).not.toContain('pain')
    }
  })
})
