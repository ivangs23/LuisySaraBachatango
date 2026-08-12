// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

import Hero from '@/components/Hero'

function renderHero() {
  return render(
    <LanguageProvider initialLocale="es">
      <Hero />
    </LanguageProvider>,
  )
}

describe('Hero CTAs', () => {
  it('el CTA primario lleva al funnel de venta', () => {
    renderHero()
    expect(screen.getByRole('link', { name: /descubre nuestros cursos/i }))
      .toHaveAttribute('href', '/curso-bachatango')
  })

  it('el CTA secundario lleva a la clase gratis', () => {
    renderHero()
    expect(screen.getByRole('link', { name: /ver clase de muestra/i }))
      .toHaveAttribute('href', '/clase-gratis')
  })
})

describe('Hero background', () => {
  it('no renderiza un elemento video sin fuentes', () => {
    const { container } = renderHero()
    expect(container.querySelector('video')).toBeNull()
  })

  it('renderiza la imagen de fondo del hero', () => {
    const { container } = renderHero()
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toContain('hero-bg')
  })
})
