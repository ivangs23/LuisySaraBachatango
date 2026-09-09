// Password family + registration PII field names (both camelCase and the
// snake_case DB column names) so a captured FormData / pending row never leaks
// to Sentry. Denylist by field NAME (values are replaced wherever the key
// appears, at any depth).
const SENSITIVE = new Set([
  'password', 'repeatPassword', 'repeat_password', 'password_hash',
  'email', 'phone', 'fullName', 'full_name',
  'dateOfBirth', 'date_of_birth', 'postalCode', 'postal_code', 'city',
])

function walk(node: unknown, seen: WeakSet<object>): void {
  if (!node || typeof node !== 'object') return
  if (seen.has(node as object)) return
  seen.add(node as object)
  if (Array.isArray(node)) {
    for (const item of node) walk(item, seen)
    return
  }
  const obj = node as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (SENSITIVE.has(key)) obj[key] = '[Filtered]'
    else walk(obj[key], seen)
  }
}

/**
 * Claves cuyo valor es una URL completa en los eventos de Sentry.
 *
 * `url.full` es la convención de OpenTelemetry que usa el SDK; `http.url` es la
 * anterior, que todavía aparece en algunos spans.
 */
const CLAVES_URL = ['url.full', 'http.url'] as const

/**
 * Quita la query de una URL conservando el resto.
 *
 * No usa `new URL()` porque en los spans llegan valores que no siempre son URLs
 * absolutas y ahí lanzaría. Cortar por el primer `?` funciona para ambos casos y
 * no puede fallar.
 */
function sinQuery(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor
  const i = valor.indexOf('?')
  return i === -1 ? valor : valor.slice(0, i)
}

function limpiarUrlsDeDatos(data: unknown): void {
  if (!data || typeof data !== 'object') return
  const obj = data as Record<string, unknown>
  for (const clave of CLAVES_URL) {
    if (clave in obj) obj[clave] = sinQuery(obj[clave])
  }
}

/**
 * Borra la query de todas las URLs del evento.
 *
 * El denylist por nombre de campo no cubría esto: la query viaja dentro de una
 * cadena, no en un campo propio. Y la de `/unsubscribe` lleva el correo del
 * suscriptor y un token de baja VÁLIDO (`utils/email/newsletter-welcome.ts:28`),
 * así que cualquiera con acceso a Sentry podía dar de baja a quien quisiera.
 *
 * Pasa en transacciones muestreadas, no solo en errores: es tráfico normal.
 *
 * Se limpian los cuatro sitios por los que viaja. Arreglar solo `request.url`
 * deja el test en verde y la fuga intacta.
 */
function scrubUrls(event: {
  request?: { url?: unknown; query_string?: unknown }
  contexts?: { trace?: { data?: unknown } }
  spans?: Array<{ data?: unknown }>
}): void {
  if (event.request) {
    if ('url' in event.request) event.request.url = sinQuery(event.request.url)
    // La query no tiene ninguna parte que valga la pena conservar.
    delete event.request.query_string
  }
  limpiarUrlsDeDatos(event.contexts?.trace?.data)
  for (const span of event.spans ?? []) limpiarUrlsDeDatos(span?.data)
}

/**
 * Limpia un evento de Sentry antes de enviarlo: campos sensibles por nombre en
 * `request.data` y `extra`, y la query de todas las URLs.
 *
 * Enganchado en `beforeSend` Y en `beforeSendTransaction` en las tres configs.
 */
export function scrubSensitive(event: {
  request?: { data?: unknown; url?: unknown; query_string?: unknown }
  extra?: Record<string, unknown>
  contexts?: { trace?: { data?: unknown } }
  spans?: Array<{ data?: unknown }>
}): void {
  const seen = new WeakSet<object>()
  walk(event.request?.data, seen)
  walk(event.extra, seen)
  scrubUrls(event)
}
