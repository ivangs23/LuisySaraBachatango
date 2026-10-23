// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// CourseCurriculum importa `formatDuration` de un módulo server-only.
vi.mock('server-only', () => ({}))
// El formulario de clases por email tiene su propio test (landing-free-email).
vi.mock('@/components/FreeClassesForm', () => ({ default: () => null, FREE_CLASSES_ANCHOR: 'clases-por-email' }))
import { render, screen } from '@testing-library/react'
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import { buildOffer } from '@/utils/courses/offer'
import LandingSections from '@/app/curso-bachatango/_components/LandingSections'
import type { Testimonial } from '@/utils/landing/content'

// Los testimonios de la landing de anuncios salen de `landing_testimonials`,
// los mismos que la home. Antes eran tres citas escritas en copy.ts.

const COPY = getLandingCopy('es')
const OFFER = buildOffer({ price_eur: 119 })

const TESTIMONIOS: Testimonial[] = [
  { id: 'a', name: 'Ana, Bilbao', quote: 'Aprendí el básico en una tarde.', stars: 5 },
  { id: 'b', name: 'Bruno, Roma', quote: 'Clarísimo.', stars: 4 },
]

function pintar(testimonials: Testimonial[]) {
  return render(
    <LandingSections
      copy={COPY}
      courseId="c1"
      offer={OFFER}
      curriculum={null}
      freeClass={null}
      testimonials={testimonials}
    />,
  )
}

describe('LandingSections · testimonios', () => {
  it('pinta los testimonios que recibe, con su nombre', () => {
    pintar(TESTIMONIOS)
    expect(screen.getByRole('heading', { name: COPY.testimonials.title })).toBeInTheDocument()
    expect(screen.getByText(/Aprendí el básico en una tarde\./)).toBeInTheDocument()
    expect(screen.getByText('Ana, Bilbao')).toBeInTheDocument()
    expect(screen.getByText('Bruno, Roma')).toBeInTheDocument()
  })

  it('no pinta la sección si no hay ninguno publicado', () => {
    pintar([])
    expect(screen.queryByRole('heading', { name: COPY.testimonials.title })).toBeNull()
  })

  it('ya no pinta las citas que vivían en copy.ts', () => {
    pintar([])
    expect(screen.queryByText('María, Madrid')).toBeNull()
    expect(screen.queryByText('Javier, Valencia')).toBeNull()
    expect(screen.queryByText('Lucía, Sevilla')).toBeNull()
  })

  it('copy.ts solo guarda el título de la sección, en los seis idiomas', () => {
    for (const locale of ['es', 'en', 'fr', 'de', 'it', 'ja'] as const) {
      expect(Object.keys(getLandingCopy(locale).testimonials), locale).toEqual(['title'])
    }
  })
})
