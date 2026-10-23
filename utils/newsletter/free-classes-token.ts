import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Token del enlace a `/clase-gratis/mas`, la página con las dos clases que se
 * mandan por email. Mismo patrón que `unsubscribe-token.ts`: HMAC del email,
 * sin sesión (quien lo abre no tiene cuenta) y sin caducidad.
 *
 * Mismo secreto, pero NO el mismo mensaje: se firma `clase-gratis:<email>`.
 * Si se firmara el email a secas, este token sería idéntico al de baja, y
 * quien recibiera el enlace reenviado —es justo el que se comparte— podría
 * dar de baja a esa persona.
 *
 * Fail-closed: sin NEWSLETTER_UNSUBSCRIBE_SECRET no se firma ni se acepta nada.
 * Rotar el secreto invalida a la vez estos enlaces y los de baja.
 */
const PROPOSITO = 'clase-gratis:'

function secret(): string | null {
  return process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || null
}

function normalise(email: string): string {
  return email.trim().toLowerCase()
}

export function makeFreeClassesToken(email: string): string | null {
  const key = secret()
  if (!key) return null
  return createHmac('sha256', key).update(PROPOSITO + normalise(email)).digest('hex')
}

export function verifyFreeClassesToken(email: string, token: string): boolean {
  const expected = makeFreeClassesToken(email)
  if (!expected || !token) return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(token, 'utf8')
  // La longitud del HMAC es pública y constante: compararla antes no filtra
  // nada y evita la excepción de timingSafeEqual.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
