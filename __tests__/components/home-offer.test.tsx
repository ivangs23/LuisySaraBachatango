// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'
import HomeOffer from '@/components/HomeOffer'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

function renderOffer(price: number) {
  return render(
    <LanguageProvider initialLocale="es">
      <HomeOffer price={price} />
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
})
