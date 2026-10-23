// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// CourseCurriculum importa `formatDuration` de un módulo server-only.
vi.mock('server-only', () => ({}))
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import { render, screen, fireEvent } from '@testing-library/react'
import LandingFaq from '@/app/curso-bachatango/_components/LandingFaq'
import LandingSections from '@/app/curso-bachatango/_components/LandingSections'
import { buildOffer } from '@/utils/courses/offer'
import type { Curriculum } from '@/utils/courses/curriculum'

// El copy ahora llega por props desde la página, que lo resuelve por idioma.
const COPY = getLandingCopy('es')
const TEMARIO: Curriculum = { modules: [], moduleCount: 14, lessonCount: 28, totalSeconds: 7920 }

describe('LandingFaq', () => {
  it('lista las preguntas y despliega la respuesta al pulsar', () => {
    render(<LandingFaq items={[{ q: '¿Necesito pareja?', a: 'No.' }]} />)
    const q = screen.getByRole('button', { name: /¿Necesito pareja\?/ })
    expect(q).toBeInTheDocument()
    // respuesta oculta hasta expandir
    expect(q).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('No.')).toBeNull()
    fireEvent.click(q)
    expect(q).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('No.')).toBeInTheDocument()
  })
})

describe('LandingSections · FAQ', () => {
  function pintar(curriculum: Curriculum | null, locale: 'es' | 'it' = 'es') {
    return render(
      <LandingSections
        copy={getLandingCopy(locale)}
        courseId="c1"
        offer={buildOffer({ price_eur: 119 })}
        curriculum={curriculum}
        freeClass={null}
        testimonials={[]}
      />,
    )
  }

  it('usa el título del copy, en el idioma de la página', () => {
    pintar(TEMARIO, 'it')
    expect(screen.getByRole('heading', { name: 'Domande frequenti' })).toBeInTheDocument()
  })

  it('responde cuánto dura con las cifras del temario', () => {
    pintar(TEMARIO)
    fireEvent.click(screen.getByRole('button', { name: '¿Cuánto dura el curso?' }))
    expect(screen.getByText(/14 módulos y 28 lecciones en vídeo, 2\sh\s12\smin en total/)).toBeInTheDocument()
  })

  it('sin temario quita esa pregunta en vez de enseñar marcadores', () => {
    const { container } = pintar(null)
    expect(screen.queryByRole('button', { name: '¿Cuánto dura el curso?' })).toBeNull()
    expect(container.textContent).not.toContain('{')
  })

  it('ya no repite la pregunta del nivel', () => {
    pintar(TEMARIO)
    expect(screen.getByRole('button', { name: '¿Qué nivel necesito?' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sin experiencia/ })).toBeNull()
  })

  it('incluye la pregunta para quien ya baila bachata', () => {
    pintar(TEMARIO)
    expect(screen.getByRole('button', { name: '¿Me sirve si ya bailo bachata?' })).toBeInTheDocument()
  })
})

describe('LandingSections · oferta', () => {
  function oferta(curriculum: Curriculum | null) {
    render(
      <LandingSections
        copy={COPY}
        courseId="c1"
        offer={buildOffer({ price_eur: 119 })}
        curriculum={curriculum}
        freeClass={null}
        testimonials={[]}
      />,
    )
    const titulo = screen.getByRole('heading', { name: COPY.offer.title })
    return [...titulo.closest('section')!.querySelectorAll('li')].map((li) => li.textContent)
  }

  it('enumera lo que incluye, con el número real de lecciones', () => {
    expect(oferta(TEMARIO)).toEqual([
      '28 lecciones en vídeo HD',
      'Cada combinación explicada y después bailada con música',
      'Acceso de por vida, en móvil y ordenador',
      'Certificado al completar el curso',
    ])
  })

  it('sin temario cae a una línea sin cifra', () => {
    expect(oferta(null)[0]).toBe('Todas las lecciones en vídeo HD')
  })
})
