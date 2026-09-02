'use server'

import { getOnlineNow } from '@/utils/admin/presence-queries'

/**
 * Refresco del contador de presencia para el panel.
 *
 * `getOnlineNow()` lanza `AdminGuardError` si quien llama no es admin: cualquier
 * otro usuario que invocase esta acción recibe `null`, nunca una cifra. El
 * `null` también cubre un fallo puntual de red, y el panel se queda con el
 * último valor bueno en vez de parpadear a cero.
 */
export async function fetchOnlineNow(): Promise<number | null> {
  try {
    return await getOnlineNow()
  } catch {
    return null
  }
}
