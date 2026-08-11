import 'server-only'
import { unstable_cache } from 'next/cache'
import { signPlaybackToken, signThumbnailToken } from './server'

/**
 * JWT de reproducción para la clase gratis pública. A diferencia de
 * `signPlaybackTokenForUser`, no va ligado a ningún usuario porque el
 * espectador puede ser anónimo.
 *
 * TTL 15 min, caché 10 min: la caché siempre expira antes que el token, así
 * que nunca se sirve un JWT ya caducado. Al no depender del usuario, todos
 * los visitantes comparten la misma entrada de caché.
 *
 * Compromiso asumido: durante esos 15 minutos la URL firmada es compartible.
 * Es aceptable — la lección es deliberadamente gratuita y pública.
 */
export async function signPublicPlaybackToken(playbackId: string): Promise<string> {
  return unstable_cache(
    () => signPlaybackToken(playbackId, '15m'),
    ['mux-public-playback', playbackId],
    { revalidate: 60 * 10 },
  )()
}

export async function signPublicThumbnailToken(playbackId: string): Promise<string> {
  return unstable_cache(
    () => signThumbnailToken(playbackId, '15m'),
    ['mux-public-thumb', playbackId],
    { revalidate: 60 * 10 },
  )()
}
