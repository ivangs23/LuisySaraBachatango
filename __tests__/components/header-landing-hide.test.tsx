// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

let mockPath = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'es',
    setLocale: () => {},
    t: {
      header: {
        courses: 'Cursos',
        events: 'Eventos',
        music: 'Música',
        community: 'Comunidad',
        about: 'Sobre Nosotros',
        login: 'Iniciar Sesión',
        profile: 'Mi Perfil',
        dashboard: 'Dashboard',
        logout: 'Cerrar Sesión',
      },
    },
  }),
}))

import Header from '@/components/Header'

describe('Header en landing', () => {
  it('no renderiza nada en /curso-bachatango', () => {
    mockPath = '/curso-bachatango'
    const { container } = render(<Header user={null} profile={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza normalmente en otras rutas', () => {
    mockPath = '/'
    const { container } = render(<Header user={null} profile={null} />)
    expect(container).not.toBeEmptyDOMElement()
  })
})
