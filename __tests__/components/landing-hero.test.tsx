// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import { buildOffer } from '@/utils/courses/offer'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/curso-bachatango',
}))

import LandingHero from '@/app/curso-bachatango/_components/LandingHero'

// El copy ahora llega por props desde la página, que lo resuelve por idioma.
const COPY = getLandingCopy('es')

const OFFER = buildOffer({ price_eur: 199 })

describe('LandingHero', () => {
  it('muestra titular, precio y CTA', () => {
    render(<LandingHero copy={COPY} courseId="c1" isAuthed={false} offer={OFFER} imageUrl={null} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Baila bachatango')
    // El precio sale dos veces: en el bloque de oferta y dentro del CTA.
    expect(screen.getAllByText(/€199/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Empieza ahora/ })).toBeInTheDocument()
  })

  it('muestra link de login cuando no está autenticado', () => {
    render(<LandingHero copy={COPY} courseId="c1" isAuthed={false} offer={OFFER} imageUrl={null} />)
    expect(screen.getByRole('link', { name: /Inicia sesión/i })).toHaveAttribute('href', '/login')
  })

  it('no muestra link de login cuando está autenticado', () => {
    render(<LandingHero copy={COPY} courseId="c1" isAuthed={true} offer={OFFER} imageUrl={null} />)
    expect(screen.queryByRole('link', { name: /Inicia sesión/i })).toBeNull()
  })

  it('tacha el precio anterior y anuncia las plazas de la oferta', () => {
    const offer = buildOffer({ price_eur: 119, compare_at_price_eur: 150, spots_left: 5 })
    const { container } = render(
      <LandingHero copy={COPY} courseId="c1" isAuthed={false} offer={offer} imageUrl={null} />,
    )
    expect(container.querySelector('s')).toHaveTextContent('€150')
    expect(screen.getByText('Quedan 5 plazas disponibles')).toBeInTheDocument()
    // El botón sigue llevando el precio que se cobra, no el tachado.
    expect(screen.getByRole('link', { name: /Empieza ahora · €119/ })).toBeInTheDocument()
  })
})
