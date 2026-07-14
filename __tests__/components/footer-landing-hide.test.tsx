// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

let mockPath = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => mockPath,
}))
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'es',
    setLocale: () => {},
    t: {
      footer: {
        description: 'Test description',
        explore: 'Explorar',
        home: 'Inicio',
        contact: 'Contacto',
        notice: 'Aviso Legal',
        legal: 'Legal',
        terms: 'Términos y Condiciones',
        privacy: 'Política de Privacidad',
        cookies: 'Política de Cookies',
        rights: 'Todos los derechos reservados.',
        blog: 'Blog',
      },
      header: {
        courses: 'Cursos',
        events: 'Eventos',
        music: 'Música',
        community: 'Comunidad',
        about: 'Sobre Nosotros',
      },
    },
  }),
}))
vi.mock('@/components/Reveal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import FooterClient from '@/components/FooterClient'

describe('FooterClient en landing', () => {
  it.each(['/curso-bachatango', '/curso-bachatango/comprar', '/gracias'])(
    'no renderiza nada en el funnel (%s)',
    (path) => {
      mockPath = path
      const { container } = render(<FooterClient adminProfile={null} />)
      expect(container).toBeEmptyDOMElement()
    },
  )

  it('renderiza normalmente en otras rutas', () => {
    mockPath = '/'
    const { container } = render(<FooterClient adminProfile={null} />)
    expect(container).not.toBeEmptyDOMElement()
  })
})
