// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/curso-bachatango',
}))

import LandingHero from '@/app/curso-bachatango/_components/LandingHero'

describe('LandingHero', () => {
  it('muestra titular, precio y CTA', () => {
    render(<LandingHero courseId="c1" isAuthed={false} price={199} imageUrl={null} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Baila bachatango')
    expect(screen.getByText(/€199/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Empieza ahora/ })).toBeInTheDocument()
  })

  it('muestra link de login cuando no está autenticado', () => {
    render(<LandingHero courseId="c1" isAuthed={false} price={199} imageUrl={null} />)
    expect(screen.getByRole('link', { name: /Inicia sesión/i })).toHaveAttribute('href', '/login')
  })

  it('no muestra link de login cuando está autenticado', () => {
    render(<LandingHero courseId="c1" isAuthed={true} price={199} imageUrl={null} />)
    expect(screen.queryByRole('link', { name: /Inicia sesión/i })).toBeNull()
  })
})
