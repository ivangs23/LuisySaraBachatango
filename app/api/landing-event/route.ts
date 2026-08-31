import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'
import { normalisePath } from '@/utils/analytics/tracked-paths'
import { dailyVisitorHash, isBot } from '@/utils/analytics/visitor-hash'

/** Respuesta única. Nunca se filtra al cliente por qué se descartó un evento. */
function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Registra una vista de página de la landing.
 *
 * Responde **204 siempre**, se guarde o no: un fallo de analítica no puede
 * romper la navegación, y distinguir los casos en la respuesta solo serviría
 * para que alguien sondee la allowlist.
 *
 * El `path` llega del navegador y es entrada no confiable: se valida contra la
 * allowlist de `tracked-paths` y solo se inserta lo que esté en ella.
 *
 * La IP se usa para el hash y para limitar; nunca se persiste.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userAgent = request.headers.get('user-agent')
    if (isBot(userAgent)) return noContent()

    const ip = getClientIp(request.headers)

    // 120/h por IP: holgado para una sesión real de navegación, corta inundaciones.
    const rl = await rateLimit(rateLimitKey([ip, 'landing-event']), 120, 60 * 60 * 1000)
    if (!rl.ok) return noContent()

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return noContent()
    }

    const path = normalisePath((body as { path?: unknown } | null)?.path)
    if (!path) return noContent()

    const visitorHash = dailyVisitorHash(ip, userAgent, new Date())
    if (!visitorHash) return noContent() // sin LANDING_ANALYTICS_SECRET

    const { error } = await createSupabaseAdmin()
      .from('landing_events')
      .insert({ path, visitor_hash: visitorHash })

    if (error) {
      console.error('[landing-event] insert failed', { message: error.message })
    }
  } catch (e) {
    console.error('[landing-event] unexpected', e)
  }

  return noContent()
}
