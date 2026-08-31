/**
 * Estado de consentimiento de cookies. Dos categorías, ambas denegadas por
 * defecto (RGPD art. 6.1.a: el consentimiento es opt-in explícito).
 *
 * - `analytics`  → GA4
 * - `marketing`  → Meta Pixel, embeds de Instagram
 *
 * Vercel Analytics y Speed Insights NO pasan por aquí: no usan cookies ni
 * identificadores persistentes, así que no requieren consentimiento previo.
 *
 * Se guarda en una cookie legible por JS (no httpOnly) para que el cliente
 * decida qué cargar sin esperar al servidor. No contiene datos personales.
 */
export const CONSENT_COOKIE = 'ls_consent'

/**
 * Subir esta versión invalida todos los consentimientos guardados y hace que
 * el banner vuelva a aparecer. Hacerlo cada vez que se añada una categoría o
 * un proveedor nuevo — el consentimiento anterior no cubre lo nuevo.
 */
export const CONSENT_VERSION = 1

export const CONSENT_MAX_AGE_DAYS = 180

export interface ConsentState {
  v: number
  analytics: boolean
  marketing: boolean
  /** ISO 8601. Prueba de cuándo se dio el consentimiento (RGPD art. 7.1). */
  at: string
}

export function makeConsent(analytics: boolean, marketing: boolean, now: Date): ConsentState {
  return { v: CONSENT_VERSION, analytics, marketing, at: now.toISOString() }
}

export function serializeConsent(s: ConsentState): string {
  return encodeURIComponent(JSON.stringify(s))
}

/**
 * Parsea el valor de la cookie. Devuelve null —y por tanto vuelve a preguntar—
 * ante cualquier duda: vacío, JSON corrupto, versión antigua o forma inválida.
 * Fail-closed: sin consentimiento válido no se carga nada de terceros.
 */
export function parseConsent(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (typeof parsed !== 'object' || parsed === null) return null
    const c = parsed as Record<string, unknown>
    if (c.v !== CONSENT_VERSION) return null
    if (typeof c.analytics !== 'boolean') return null
    if (typeof c.marketing !== 'boolean') return null
    if (typeof c.at !== 'string') return null
    return { v: CONSENT_VERSION, analytics: c.analytics, marketing: c.marketing, at: c.at }
  } catch {
    return null
  }
}
