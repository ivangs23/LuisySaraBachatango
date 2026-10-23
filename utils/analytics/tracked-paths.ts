/**
 * Rutas que se miden y pasos del embudo.
 *
 * Es la única declaración: la API valida contra `TRACKED_PATHS` y el panel
 * construye el embudo desde `FUNNEL_STEPS`, así que no pueden desincronizarse.
 *
 * Sin `import 'server-only'` a propósito: `components/LandingAnalytics.tsx` lo
 * usa en cliente para no mandar beacons de rutas que se van a descartar.
 */
export const TRACKED_PATHS = [
  '/',
  '/curso-bachatango',
  '/clase-gratis',
  '/curso-bachatango/comprar',
  '/curso-bachatango/comprar/enviado',
  '/gracias',
  '/curso-bachatango/clase-play',
  '/curso-bachatango/lead',
] as const

export type TrackedPath = (typeof TRACKED_PATHS)[number]

/**
 * Primer `play` de la clase gratis incrustada en la landing. Es un EVENTO, no
 * una página: no existe ninguna ruta con ese nombre. Se guarda en
 * `landing_events` con esta ruta virtual para medirlo con la misma tubería
 * (sin cookies, hash diario) que las vistas. Una vez por carga de página.
 */
export const FREE_CLASS_PLAY_PATH = '/curso-bachatango/clase-play' satisfies TrackedPath

/**
 * Email capturado en el formulario «dos clases más por email» de la landing.
 * EVENTO, no página: lo registra la Server Action (`app/actions/free-classes.ts`)
 * al guardar la suscripción, no un beacon del navegador.
 */
export const FREE_CLASS_LEAD_PATH = '/curso-bachatango/lead' satisfies TrackedPath

/**
 * Rutas medidas que no son vistas de página. El panel no las cuenta en el
 * tráfico ni son pasos del embudo.
 */
export const EVENT_PATHS: readonly TrackedPath[] = [FREE_CLASS_PLAY_PATH, FREE_CLASS_LEAD_PATH]

/** Cota defensiva: una ruta real nunca se acerca, y evita trabajo inútil. */
const MAX_PATH_LENGTH = 512

/**
 * Devuelve la ruta medida correspondiente, o null si no lo es.
 *
 * El valor viene del navegador, así que se trata como no confiable: se
 * normaliza y se comprueba contra la allowlist. Lo que no esté en la lista no
 * llega nunca a la base de datos.
 */
export function normalisePath(raw: unknown): TrackedPath | null {
  if (typeof raw !== 'string') return null
  if (raw.length === 0 || raw.length > MAX_PATH_LENGTH) return null

  // Solo rutas absolutas de este sitio: '//evil.com' es una URL protocol-relative.
  if (!raw.startsWith('/') || raw.startsWith('//')) return null

  const withoutHash = raw.split('#')[0]
  const withoutQuery = withoutHash.split('?')[0]
  const trimmed =
    withoutQuery.length > 1 && withoutQuery.endsWith('/')
      ? withoutQuery.slice(0, -1)
      : withoutQuery

  return (TRACKED_PATHS as readonly string[]).includes(trimmed)
    ? (trimmed as TrackedPath)
    : null
}

/**
 * Pasos del embudo, en orden. `/clase-gratis` se mide pero no es un paso: es
 * una entrada lateral, no un punto por el que todos pasen.
 */
export const FUNNEL_STEPS = [
  { path: '/', label: 'Inicio' },
  { path: '/curso-bachatango', label: 'Página de venta' },
  { path: '/curso-bachatango/comprar', label: 'Formulario de compra' },
  { path: '/curso-bachatango/comprar/enviado', label: 'Formulario enviado' },
  { path: '/gracias', label: 'Compra completada' },
] as const satisfies readonly { path: TrackedPath; label: string }[]
