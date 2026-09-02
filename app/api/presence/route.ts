import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'
import { dailyVisitorHash, isBot } from '@/utils/analytics/visitor-hash'
import { isDemoMode } from '@/utils/demo/mode'

/** Respuesta única. Nunca se filtra al cliente por qué se descartó un latido. */
function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Latido de presencia: marca que este visitante sigue en la web.
 *
 * No lee NADA del cuerpo de la petición a propósito. Lo único que se guarda se
 * deriva en servidor (hash del visitante y hora), así que el cliente no puede
 * inyectar ni una ruta ni una etiqueta. El cuerpo, si llega, se ignora.
 *
 * Responde **204 siempre**, se guarde o no: igual que /api/landing-event, un
 * fallo de analítica no puede romper la navegación.
 *
 * La IP se usa para el hash y para limitar; nunca se persiste.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Local y preview escriben en la MISMA base de datos que producción; sin
    // esto, `npm run dev` y la suite E2E aparecerían como gente conectada.
    if (isDemoMode()) return noContent()

    const userAgent = request.headers.get('user-agent')
    if (isBot(userAgent)) return noContent()

    const ip = getClientIp(request.headers)

    // Un latido cada 45 s son 80/h. 240/h deja sitio a varias pestañas abiertas
    // detrás de la misma IP (una casa, una academia) y corta las inundaciones.
    const rl = await rateLimit(rateLimitKey([ip, 'presence']), 240, 60 * 60 * 1000)
    if (!rl.ok) return noContent()

    const visitorHash = dailyVisitorHash(ip, userAgent, new Date())
    if (!visitorHash) return noContent() // sin LANDING_ANALYTICS_SECRET

    // Upsert por clave primaria: el visitante refresca su fila, no crea otra.
    const { error } = await createSupabaseAdmin()
      .from('online_pings')
      .upsert(
        { visitor_hash: visitorHash, last_seen: new Date().toISOString() },
        { onConflict: 'visitor_hash' },
      )

    if (error) {
      console.error('[presence] upsert failed', { message: error.message })
    }
  } catch (e) {
    console.error('[presence] unexpected', e)
  }

  return noContent()
}
