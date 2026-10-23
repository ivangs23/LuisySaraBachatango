import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))

const notFound = vi.fn(() => { throw new Error('NOT_FOUND') })
vi.mock('next/navigation', () => ({ notFound: () => notFound() }))
vi.mock('@/utils/i18n/get-locale', () => ({ getCurrentLocale: async () => 'es' }))

const getExtraFreeLessons = vi.fn()
vi.mock('@/utils/courses/extra-free-lessons', () => ({ getExtraFreeLessons: () => getExtraFreeLessons() }))

// Se firma en cada render: si se cacheara, el token embebido podría llegar
// caducado (ver utils/mux/public-token.ts).
const signPlayback = vi.fn(async (id: string) => `play-${id}`)
const signThumb = vi.fn(async (id: string) => `thumb-${id}`)
vi.mock('@/utils/mux/public-token', () => ({
  signPublicPlaybackToken: (id: string) => signPlayback(id),
  signPublicThumbnailToken: (id: string) => signThumb(id),
}))

// El reproductor real es de cliente y arrastra Mux; aquí basta su título.
vi.mock('@/components/FreeClassPlayer', () => ({
  default: (p: { title: string; playbackToken: string }) => <div data-player={p.playbackToken}>{p.title}</div>,
}))

import ClasesExtraPage, { metadata } from '@/app/clase-gratis/mas/page'
import { makeFreeClassesToken } from '@/utils/newsletter/free-classes-token'

const LECCIONES = [
  { id: 'a', title: 'POSTURAS', description: null, mux_playback_id: 'pb1' },
  { id: 'b', title: 'SEGUNDO BÁSICO - CUADRADO', description: null, mux_playback_id: 'pb2' },
]

function abrir(e?: string, t?: string) {
  return ClasesExtraPage({ searchParams: Promise.resolve({ e, t }) })
}

describe('/clase-gratis/mas', () => {
  beforeEach(() => {
    vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', 'secreto-de-prueba')
    getExtraFreeLessons.mockResolvedValue(LECCIONES)
    notFound.mockClear()
    signPlayback.mockClear()
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('con el enlace del email enseña las dos clases y el camino al curso', async () => {
    const html = renderToStaticMarkup(await abrir('ana@example.com', makeFreeClassesToken('ana@example.com')!))
    expect(html).toContain('POSTURAS')
    expect(html).toContain('SEGUNDO BÁSICO - CUADRADO')
    expect(html).toContain('href="/curso-bachatango"')
  })

  it('firma un token por clase en cada visita', async () => {
    renderToStaticMarkup(await abrir('ana@example.com', makeFreeClassesToken('ana@example.com')!))
    expect(signPlayback).toHaveBeenCalledWith('pb1')
    expect(signPlayback).toHaveBeenCalledWith('pb2')
  })

  it('404 si el token no corresponde al email', async () => {
    await expect(abrir('otra@example.com', makeFreeClassesToken('ana@example.com')!)).rejects.toThrow('NOT_FOUND')
  })

  it('404 sin email o sin token', async () => {
    await expect(abrir(undefined, 'x')).rejects.toThrow('NOT_FOUND')
    await expect(abrir('ana@example.com', undefined)).rejects.toThrow('NOT_FOUND')
  })

  it('si las clases no se pueden cargar, lo dice en vez de enseñar un hueco', async () => {
    getExtraFreeLessons.mockResolvedValue([])
    const html = renderToStaticMarkup(await abrir('ana@example.com', makeFreeClassesToken('ana@example.com')!))
    expect(html).toContain('Ahora mismo no podemos mostrar las clases')
  })

  it('no se indexa: lleva el email en la URL', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
