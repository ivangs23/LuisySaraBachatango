// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// CourseCurriculum importa `formatDuration` de un módulo server-only.
vi.mock('server-only', () => ({}))
import { render, screen } from '@testing-library/react'
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import LandingSections from '@/app/curso-bachatango/_components/LandingSections'
import { buildOffer } from '@/utils/courses/offer'
import { LOCALES } from '@/utils/i18n/types'

const COPY = getLandingCopy('es')

function pintar() {
  return render(
    <LandingSections
      copy={COPY}
      courseId="c1"
      offer={buildOffer({ price_eur: 119 })}
      curriculum={null}
      freeClass={null}
      testimonials={[]}
    />,
  )
}

// A un desconocido que llega de un anuncio le sobra un «instructores
// internacionales» genérico: necesita saber por qué fiarse. El bloque de
// autoridad sustituye a la bio con hechos concretos y comprobables.
describe('LandingSections · autoridad', () => {
  it('cuenta quiénes son con hechos concretos', () => {
    pintar()
    expect(screen.getByRole('heading', { name: COPY.authority.title })).toBeInTheDocument()
    const cuerpo = screen.getByText(/bailan juntos desde 2002/)
    expect(cuerpo).toHaveTextContent('Il Divo')
    expect(cuerpo).toHaveTextContent('Juez Nacional de Baile Deportivo')
  })

  // D7. Prensa: la 1.ª edición de Telecinco (2024) la ganó María Isabel con
  // Luis Montero; Sara García llegó a la final con Adrián Lastra. «Ganaron
  // los dos» sería publicidad engañosa en el titular de un anuncio.
  it('precisa quién ganó Bailando con las Estrellas y quién fue finalista', () => {
    pintar()
    expect(screen.getByText(/bailan juntos desde 2002/)).toHaveTextContent(
      'Luis ganó la primera edición de Bailando con las Estrellas (Telecinco, 2024) y Sara llegó a la final.',
    )
  })

  it('en español no dice en ningún sitio que ganaran los dos', () => {
    expect(JSON.stringify(COPY)).not.toMatch(/ganadores|ganaron/i)
  })

  it('el CTA final invita a empezar por la lección 1', () => {
    pintar()
    expect(screen.getByRole('heading', { name: 'Empieza hoy con la lección 1' })).toBeInTheDocument()
  })

  it('la bio genérica ya no existe en ningún idioma', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(getLandingCopy(locale)), locale).not.toContain('bio')
    }
  })
})
