import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Token HMAC para el enlace de baja de la newsletter. Va en la URL del email,
 * así que debe poder verificarse sin sesión: quien se da de baja normalmente
 * no tiene cuenta.
 *
 * Sin caducidad a propósito — un enlace de baja que expira es un enlace de
 * baja roto, y el RGPD art. 7.3 exige que retirar el consentimiento sea tan
 * fácil como darlo. Para revocar todos los enlaces de golpe, rotar
 * NEWSLETTER_UNSUBSCRIBE_SECRET.
 *
 * Fail-closed: sin NEWSLETTER_UNSUBSCRIBE_SECRET no se firma ni se acepta nada.
 */
function secret(): string | null {
  return process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || null
}

function normalise(email: string): string {
  return email.trim().toLowerCase()
}

export function makeUnsubscribeToken(email: string): string | null {
  const key = secret()
  if (!key) return null
  return createHmac('sha256', key).update(normalise(email)).digest('hex')
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = makeUnsubscribeToken(email)
  if (!expected || !token) return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(token, 'utf8')
  // timingSafeEqual exige longitudes iguales; comparar antes evita la excepción
  // y no filtra nada: la longitud del HMAC es pública y constante.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
