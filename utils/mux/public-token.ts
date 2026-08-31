import 'server-only'
import { signPlaybackToken, signThumbnailToken } from './server'

/**
 * TTL de los JWT públicos de la clase gratis.
 *
 * Debe superar con holgura la ventana de ISR de `/clase-gratis`
 * (`revalidate = 300`), porque el token viaja EMBEBIDO en el HTML cacheado:
 * quien recibe esa página en el último segundo de su vida útil se lleva el
 * mismo token que quien la recibió al principio.
 *
 * Antes esto era 15 min con la firma cacheada 10 min en `unstable_cache`, y
 * las tres ventanas se apilaban: HTML 5 min + firma 10 min + TTL 15 min podía
 * dejar a un visitante con un token ya caducado. Lighthouse lo cazó con
 * `MediaError: The video's secured playback-token has expired`.
 *
 * Ahora se firma en cada render y el TTL es de 1 hora. Firmar es RS256 local,
 * sin red: cachearlo no ahorraba nada relevante y solo añadía una ventana más
 * que cuadrar. A cambio, la URL firmada es compartible durante esa hora — algo
 * asumible en una lección deliberadamente gratuita y pública.
 */
const PUBLIC_TOKEN_TTL = '1h'

export async function signPublicPlaybackToken(playbackId: string): Promise<string> {
  return signPlaybackToken(playbackId, PUBLIC_TOKEN_TTL)
}

export async function signPublicThumbnailToken(playbackId: string): Promise<string> {
  return signThumbnailToken(playbackId, PUBLIC_TOKEN_TTL)
}
