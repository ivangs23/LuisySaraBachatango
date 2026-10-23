// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import { buildOffer } from '@/utils/courses/offer'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/curso-bachatango',
}))

// La portada pasa por `isOptimizableImageUrl`, que compara contra el host de
// esta variable. Sin ella el guardián es fail-closed y no habría <img>.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jytokoxbsykoyifzbjkd.supabase.co'

import LandingHero from '@/app/curso-bachatango/_components/LandingHero'

// El copy ahora llega por props desde la página, que lo resuelve por idioma.
const COPY = getLandingCopy('es')

const OFFER = buildOffer({ price_eur: 199 })

// El subtítulo llega ya resuelto con las cifras del temario: el hero es un
// componente de cliente y el temario sale de un módulo server-only. La
// interpolación se prueba en __tests__/app/curriculum-copy.test.ts (heroSub).
const SUB = '14 módulos, 28 lecciones en vídeo, 2 h 12 min. Aprendes el rol de leader y el de follower, así que puedes empezar sin pareja.'

describe('LandingHero', () => {
  it('muestra titular, precio y CTA', () => {
    render(<LandingHero copy={COPY} sub={SUB} courseId="c1" isAuthed={false} offer={OFFER} imageUrl={null} />)
    // D7: los dos llegaron a la final; ganó Luis. «Los ganadores» no es exacto.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Aprende bachatango con los finalistas de Bailando con las Estrellas',
    )
    // El precio sale dos veces: en el bloque de oferta y dentro del CTA.
    expect(screen.getAllByText(/€199/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Empieza ahora/ })).toBeInTheDocument()
  })

  it('pinta el subtítulo con las cifras que le llegan del servidor', () => {
    render(<LandingHero copy={COPY} sub={SUB} courseId="c1" isAuthed={false} offer={OFFER} imageUrl={null} />)
    expect(screen.getByText(SUB)).toBeInTheDocument()
  })

  it('muestra link de login cuando no está autenticado', () => {
    render(<LandingHero copy={COPY} sub={SUB} courseId="c1" isAuthed={false} offer={OFFER} imageUrl={null} />)
    expect(screen.getByRole('link', { name: /Inicia sesión/i })).toHaveAttribute('href', '/login')
  })

  it('no muestra link de login cuando está autenticado', () => {
    render(<LandingHero copy={COPY} sub={SUB} courseId="c1" isAuthed={true} offer={OFFER} imageUrl={null} />)
    expect(screen.queryByRole('link', { name: /Inicia sesión/i })).toBeNull()
  })

  it('tacha el precio anterior y anuncia las plazas de la oferta', () => {
    const offer = buildOffer({ price_eur: 119, compare_at_price_eur: 150, spots_left: 5 })
    const { container } = render(
      <LandingHero copy={COPY} sub={SUB} courseId="c1" isAuthed={false} offer={offer} imageUrl={null} />,
    )
    expect(container.querySelector('s')).toHaveTextContent('€150')
    expect(screen.getByText('Quedan 5 plazas disponibles')).toBeInTheDocument()
    // El botón sigue llevando el precio que se cobra, no el tachado.
    expect(screen.getByRole('link', { name: /Empieza ahora · €119/ })).toBeInTheDocument()
  })

  const PORTADA =
    'https://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/public/thumbnails/course-covers/a.png'

  it('pinta la portada como <img> con prioridad, no como background-image', () => {
    const { container } = render(
      <LandingHero copy={COPY} sub={SUB} courseId="c1" isAuthed={false} offer={OFFER} imageUrl={PORTADA} />,
    )
    // El elemento LCP tiene que ser descubrible en el HTML: con una
    // background-image el navegador esperaba 3,55 s a parsear el CSS.
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('fetchpriority', 'high')
    // Decorativa: el titular ya dice lo que hay que leer.
    expect(img).toHaveAttribute('alt', '')
    expect(container.querySelector('section')?.getAttribute('style') ?? '')
      .not.toContain('background-image')
  })

  it('omite la portada —sin romper la página— si el host no es optimizable', () => {
    const { container } = render(
      <LandingHero
        copy={COPY}
        sub={SUB}
        courseId="c1"
        isAuthed={false}
        offer={OFFER}
        imageUrl="https://evil.example.com/a.png"
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('se renderiza sin portada cuando imageUrl es null', () => {
    const { container } = render(
      <LandingHero copy={COPY} sub={SUB} courseId="c1" isAuthed={false} offer={OFFER} imageUrl={null} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
