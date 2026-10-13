/**
 * Datos de atribución de Meta que viajan del navegador al webhook de Stripe.
 *
 * El problema que resuelve: la API de conversiones se llama desde el webhook,
 * que lo invoca Stripe servidor contra servidor. Ahí no hay cookies del
 * visitante, ni su IP, ni su user agent — y sin `_fbp`/`_fbc` Meta no sabe
 * casar la compra con el anuncio que la provocó. Así que todo eso se captura
 * al crear la sesión de Checkout (donde sí hay petición del navegador) y se
 * guarda en `session.metadata`, que el webhook sí recibe.
 *
 * Límites de Stripe que impone este módulo: cada valor de metadata admite 500
 * caracteres como máximo y la clave 40. Un user agent largo o un `fbc`
 * malformado reventarían la creación de la sesión — es decir, la venta — así
 * que aquí se recorta antes de llegar a Stripe.
 */

/** Tope por valor de metadata en Stripe. */
export const STRIPE_METADATA_MAX = 500

export interface MetaAttribution {
  /** Cookie `_fbp`, que pone el píxel. */
  fbp: string | null
  /** Cookie `_fbc`, o reconstruida desde `fbclid`. */
  fbc: string | null
  /** IP del cliente, tal y como la ve la plataforma. */
  ip: string | null
  /** User agent del navegador. */
  ua: string | null
  /** El visitante aceptó cookies de marketing. Decide si el servidor reporta. */
  marketingConsent: boolean
}

/** Claves con las que viaja dentro de `session.metadata`. */
export const META_KEYS = {
  fbp: 'fbp',
  fbc: 'fbc',
  ip: 'client_ip',
  ua: 'client_ua',
  consent: 'fb_consent',
} as const

function trim(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const clean = value.trim()
  if (!clean) return null
  return clean.slice(0, STRIPE_METADATA_MAX)
}

/**
 * Construye el `_fbc` a partir de un `fbclid` de la URL, con el formato que
 * documenta Meta: `fb.<subdominios>.<timestamp_ms>.<fbclid>`.
 *
 * Normalmente no hace falta — el píxel escribe la cookie `_fbc` al ver el
 * `fbclid`—, pero si el visitante llegó y compró antes de que el píxel la
 * escribiera, o navegó con la cookie bloqueada, esto la recupera.
 */
export function buildFbcFromFbclid(fbclid: string | null | undefined, nowMs: number): string | null {
  const clean = trim(fbclid)
  if (!clean) return null
  // El fbclid es alfanumérico con guiones y guiones bajos. Cualquier otra cosa
  // es basura de un enlace manipulado y no se mete en metadata.
  if (!/^[A-Za-z0-9_-]+$/.test(clean)) return null
  return `fb.1.${Math.trunc(nowMs)}.${clean}`
}

/**
 * Reúne la atribución a partir de las cookies y cabeceras de la petición.
 *
 * `fbclid` solo se usa si no hay cookie `_fbc`: la cookie la escribió el píxel
 * con el clic real y es más fiable que un parámetro de URL que cualquiera
 * puede pegar.
 */
export function collectAttribution(input: {
  fbpCookie?: string | null
  fbcCookie?: string | null
  fbclid?: string | null
  ip?: string | null
  userAgent?: string | null
  marketingConsent: boolean
  nowMs: number
}): MetaAttribution {
  const fbc = trim(input.fbcCookie) ?? buildFbcFromFbclid(input.fbclid, input.nowMs)
  // `getClientIp` devuelve 'anon' cuando no hay ninguna cabecera utilizable;
  // mandarle a Meta la cadena "anon" como IP sería peor que no mandar nada.
  const rawIp = trim(input.ip)
  return {
    fbp: trim(input.fbpCookie),
    fbc,
    ip: rawIp === 'anon' ? null : rawIp,
    ua: trim(input.userAgent),
    marketingConsent: input.marketingConsent,
  }
}

/**
 * Convierte la atribución en entradas de `session.metadata`.
 *
 * Solo se escriben las claves con valor: Stripe cuenta 50 claves por objeto y
 * no tiene sentido gastar cupo en nulos. El consentimiento sí va siempre —
 * ausencia y "no" deben distinguirse en el webhook, y la ausencia de la clave
 * se trata como "no" (fail-closed).
 */
export function attributionToMetadata(a: MetaAttribution): Record<string, string> {
  const meta: Record<string, string> = { [META_KEYS.consent]: a.marketingConsent ? '1' : '0' }
  if (a.fbp) meta[META_KEYS.fbp] = a.fbp
  if (a.fbc) meta[META_KEYS.fbc] = a.fbc
  if (a.ip) meta[META_KEYS.ip] = a.ip
  if (a.ua) meta[META_KEYS.ua] = a.ua
  return meta
}

/** Lee de vuelta lo que se guardó, desde el webhook. */
export function attributionFromMetadata(
  metadata: Record<string, string> | null | undefined,
): MetaAttribution {
  const m = metadata ?? {}
  return {
    fbp: m[META_KEYS.fbp] || null,
    fbc: m[META_KEYS.fbc] || null,
    ip: m[META_KEYS.ip] || null,
    ua: m[META_KEYS.ua] || null,
    // Fail-closed: cualquier valor que no sea exactamente '1' es un no.
    marketingConsent: m[META_KEYS.consent] === '1',
  }
}
