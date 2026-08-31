import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

const signPlayback = vi.fn<(id: string, ttl: string) => Promise<string>>()
const signThumbnail = vi.fn<(id: string, ttl: string) => Promise<string>>()

vi.mock('@/utils/mux/server', () => ({
  signPlaybackToken: (id: string, ttl: string) => signPlayback(id, ttl),
  signThumbnailToken: (id: string, ttl: string) => signThumbnail(id, ttl),
}))

import { signPublicPlaybackToken, signPublicThumbnailToken } from '@/utils/mux/public-token'

/** `revalidate` de app/clase-gratis/page.tsx, en segundos. */
const ISR_WINDOW_SECONDS = 300

function ttlToSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl)
  if (!m) throw new Error(`TTL no reconocido: ${ttl}`)
  const n = Number(m[1])
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd']
}

describe('tokens públicos de Mux', () => {
  beforeEach(() => {
    signPlayback.mockReset().mockResolvedValue('tok')
    signThumbnail.mockReset().mockResolvedValue('thumb')
  })

  it('firma el token de reproducción con el playbackId recibido', async () => {
    await signPublicPlaybackToken('pb1')
    expect(signPlayback).toHaveBeenCalledTimes(1)
    expect(signPlayback.mock.calls[0][0]).toBe('pb1')
  })

  it('firma el thumbnail con el playbackId recibido', async () => {
    await signPublicThumbnailToken('pb1')
    expect(signThumbnail.mock.calls[0][0]).toBe('pb1')
  })

  /**
   * El token viaja embebido en el HTML que ISR cachea 5 minutos: quien recibe
   * esa página en su último segundo se lleva el mismo token que quien la
   * recibió al principio. Un TTL corto deja a ese visitante con un vídeo que
   * no arranca — pasó de verdad y Lighthouse lo cazó.
   */
  it('el TTL supera con holgura la ventana de ISR', async () => {
    await signPublicPlaybackToken('pb1')
    const ttl = ttlToSeconds(signPlayback.mock.calls[0][1])
    expect(
      ttl,
      `TTL ${ttl}s frente a una ventana de ISR de ${ISR_WINDOW_SECONDS}s: demasiado ajustado`,
    ).toBeGreaterThanOrEqual(ISR_WINDOW_SECONDS * 4)
  })

  it('reproducción y thumbnail comparten TTL', async () => {
    await signPublicPlaybackToken('pb1')
    await signPublicThumbnailToken('pb1')
    expect(signThumbnail.mock.calls[0][1]).toBe(signPlayback.mock.calls[0][1])
  })

  /**
   * Antes se envolvían en `unstable_cache`, y esa ventana se apilaba con la de
   * ISR y con el propio TTL. Firmar es RS256 local: no hay nada que cachear.
   */
  it('firma en cada llamada, sin capa de caché', async () => {
    await signPublicPlaybackToken('pb1')
    await signPublicPlaybackToken('pb1')
    expect(signPlayback).toHaveBeenCalledTimes(2)
  })
})
