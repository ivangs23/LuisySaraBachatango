import 'server-only'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { isDemoMode } from '@/utils/demo/mode'
import { dailyVisitorHash } from './visitor-hash'
import type { TrackedPath } from './tracked-paths'

/**
 * Registra en `landing_events` un evento que ocurre en servidor (una Server
 * Action), con la misma tubería que las vistas de `/api/landing-event`: hash
 * diario del visitante, sin cookies y sin guardar la IP.
 *
 * Igual que allí: se descarta en modo demo (local y preview no deben inflar
 * las métricas reales) y sin LANDING_ANALYTICS_SECRET. Nunca lanza: la
 * analítica no puede tumbar la acción que la dispara.
 */
export async function recordServerEvent(
  path: TrackedPath,
  ip: string,
  userAgent: string | null,
): Promise<void> {
  if (isDemoMode()) return
  try {
    const visitorHash = dailyVisitorHash(ip, userAgent, new Date())
    if (!visitorHash) return
    const { error } = await createSupabaseAdmin()
      .from('landing_events')
      .insert({ path, visitor_hash: visitorHash })
    if (error) console.error('[server-event] insert failed', { path, message: error.message })
  } catch (e) {
    console.error('[server-event] unexpected', { path, message: (e as Error).message })
  }
}
