// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'es',
    setLocale: () => {},
    t: {
      footer: {
        description: 'Test description', explore: 'Explorar', home: 'Inicio', contact: 'Contacto',
        notice: 'Aviso Legal', legal: 'Legal', terms: 'Términos', privacy: 'Privacidad',
        cookies: 'Cookies', social: 'Redes sociales', rights: 'Todos los derechos reservados.',
        blog: 'Blog', buyCourse: 'El curso',
      },
      header: { courses: 'Cursos', events: 'Eventos', music: 'Música', community: 'Comunidad', about: 'Sobre Nosotros' },
      consent: { manage: 'Preferencias de cookies' },
    },
  }),
}))
vi.mock('@/context/ConsentContext', () => ({
  useConsent: () => ({ state: null, hydrated: true, isOpen: false, save: () => {}, reopen: () => {} }),
}))
vi.mock('@/components/Reveal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Si el pie volviera a leer perfiles, esta es la llamada que haría.
const createClient = vi.fn()
vi.mock('@/utils/supabase/server', () => ({ createClient: () => createClient() }))

import Footer from '@/components/Footer'
import { SOCIAL_URLS } from '@/utils/brand/social'

// Antes el pie tomaba las redes del último perfil actualizado que tuviera
// Instagram, fuera de quien fuera: cualquier alumno que rellenara su perfil
// pasaba a ser el Instagram de la marca para todo el sitio.
describe('Footer · redes oficiales', () => {
  it('no consulta la base de datos', () => {
    render(<Footer />)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('enlaza las cuatro cuentas oficiales', () => {
    render(<Footer />)
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', SOCIAL_URLS.instagram)
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', SOCIAL_URLS.facebook)
    expect(screen.getByRole('link', { name: 'TikTok' })).toHaveAttribute('href', SOCIAL_URLS.tiktok)
    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute('href', SOCIAL_URLS.youtube)
  })

  it('las URLs oficiales son https y no llevan parámetros de rastreo', () => {
    for (const url of Object.values(SOCIAL_URLS)) {
      const u = new URL(url)
      expect(u.protocol, url).toBe('https:')
      expect([...u.searchParams.keys()].filter((k) => k !== 'id'), url).toEqual([])
    }
  })
})
