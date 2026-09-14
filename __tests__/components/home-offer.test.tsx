// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'
import HomeOffer from '@/components/HomeOffer'
import { buildOffer } from '@/utils/courses/offer'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

function renderOffer(
  price: number,
  extra: { compare_at_price_eur?: number | null; spots_left?: number | null } = {},
) {
  return render(
    <LanguageProvider initialLocale="es">
      <HomeOffer offer={buildOffer({ price_eur: price, ...extra })} />
    </LanguageProvider>,
  )
}

describe('HomeOffer', () => {
  it('muestra el precio recibido por props', () => {
    renderOffer(97)
    expect(screen.getByText('97 €')).toBeInTheDocument()
  })

  it('enlaza al funnel de venta', () => {
    renderOffer(97)
    expect(screen.getByRole('link', { name: /ver el curso/i }))
      .toHaveAttribute('href', '/curso-bachatango')
  })

  it('lista los cuatro puntos incluidos', () => {
    renderOffer(97)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('renderiza un h2 accesible', () => {
    renderOffer(97)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it('tacha el precio anterior y anuncia las plazas', () => {
    const { container } = renderOffer(119, { compare_at_price_eur: 150, spots_left: 5 })
    expect(container.querySelector('s')).toHaveTextContent('150 €')
    expect(screen.getByText('119 €')).toBeInTheDocument()
    expect(screen.getByText('Quedan 5 plazas disponibles')).toBeInTheDocument()
  })

  it('no tacha nada si el precio anterior no supera al actual', () => {
    const { container } = renderOffer(119, { compare_at_price_eur: 119 })
    expect(container.querySelector('s')).toBeNull()
  })

  it('no anuncia plazas cuando no quedan', () => {
    renderOffer(119, { spots_left: 0 })
    expect(screen.queryByText(/plazas disponibles/)).toBeNull()
  })
})
