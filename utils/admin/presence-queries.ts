import 'server-only'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { requireAdmin } from '@/utils/auth/require-admin'

/**
 * Cuánto tiempo sigue contando un visitante tras su último latido.
 *
 * Los latidos van cada 45 s (`HEARTBEAT_MS`), así que con 2 minutos hacen falta
 * dos latidos perdidos seguidos para que alguien desaparezca del contador. Al
 * revés: quien cierra el navegador tarda como mucho 2 minutos en irse.
 */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000

/**
 * Cuántos visitantes hay ahora mismo en la web.
 *
 * Doble barrera de acceso, a propósito:
 *   1. `requireAdmin()` aquí, ANTES de abrir el cliente de servicio.
 *   2. La policy `online_pings admin SELECT` en la propia tabla.
 * La segunda cubre cualquier consulta que no pase por esta función.
 *
 * `head: true` cuenta en el servidor de Postgres: ni un solo `visitor_hash`
 * llega a viajar por la red.
 */
export async function getOnlineNow(): Promise<number> {
  await requireAdmin()

  const sb = createSupabaseAdmin()
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()

  const { count, error } = await sb
    .from('online_pings')
    .select('visitor_hash', { count: 'exact', head: true })
    .gte('last_seen', cutoff)

  if (error) {
    console.error('[presence] count failed', { message: error.message })
    return 0
  }

  return count ?? 0
}
