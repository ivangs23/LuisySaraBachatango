// utils/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { alertaCritica } from '@/utils/alerta'

export type RateLimitResult = { ok: boolean; retryAfter: number }

// Local fallback: used when Upstash env vars are missing (tests, local dev).
type Bucket = { count: number; resetAt: number }
const localBuckets = new Map<string, Bucket>()

function localRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = localBuckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    localBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

// Upstash: cache Ratelimit instances by (limit, windowMs).
const ratelimitCache = new Map<string, Ratelimit>()

function getUpstashClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getRatelimit(limit: number, windowMs: number): Ratelimit | null {
  const redis = getUpstashClient()
  if (!redis) return null
  const cacheKey = `${limit}:${windowMs}`
  const cached = ratelimitCache.get(cacheKey)
  if (cached) return cached
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
    prefix: 'rl',
  })
  ratelimitCache.set(cacheKey, rl)
  return rl
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const rl = getRatelimit(limit, windowMs)
  if (!rl) return localRateLimit(key, limit, windowMs)

  try {
    const { success, reset } = await rl.limit(key)
    return {
      ok: success,
      retryAfter: success ? 0 : Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
    }
  } catch (err) {
    console.error('[rate-limit] Upstash error', err)
    // Fallar cerrado en producción convierte una caída de Upstash en una caída
    // del sitio: tumba login, alta, los dos checkouts y /monitoring, que es el
    // túnel por el que Sentry recibe los errores de navegador. Es decir, el
    // incidente apaga a la vez el servicio y media capacidad de verlo.
    //
    // Con freno a propósito: este catch se ejecuta en CADA petición mientras
    // dure el corte. Sin él, el aviso se convertiría en la inundación que
    // `alertaCritica` existe para evitar.
    avisarCorteDeLimitador(err)
    if (process.env.NODE_ENV === 'production') {
      // Fail closed in production rather than serving requests without rate
      // limiting at scale (the local Map fallback is per-instance only on
      // Vercel and provides no real protection across the fleet).
      return { ok: false, retryAfter: 60 }
    }
    return localRateLimit(key, limit, windowMs)
  }
}

/** Una alerta cada 5 minutos como mucho, por instancia. */
const INTERVALO_AVISO_MS = 5 * 60 * 1000
let ultimoAviso = 0

function avisarCorteDeLimitador(err: unknown): void {
  const ahora = Date.now()
  if (ahora - ultimoAviso < INTERVALO_AVISO_MS) return
  ultimoAviso = ahora
  alertaCritica('Limitador caído: en producción esto deniega login, alta y checkout', {
    mensaje: err instanceof Error ? err.message : String(err),
    fallaCerrado: process.env.NODE_ENV === 'production',
  })
}

export function rateLimitKey(parts: (string | null | undefined)[]): string {
  return parts.map(p => p ?? 'anon').join(':')
}

export function _resetRateLimitForTest(): void {
  if (process.env.NODE_ENV === 'production') return
  localBuckets.clear()
  ratelimitCache.clear()
}
