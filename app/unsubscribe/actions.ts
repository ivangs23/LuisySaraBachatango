'use server'

import { headers } from 'next/headers'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'
import { verifyUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Marca una dirección como dada de baja. Se autentica con el HMAC del enlace
 * del email, no con sesión: quien se da de baja normalmente no tiene cuenta.
 *
 * Idempotente: darse de baja dos veces sobreescribe la fecha y devuelve ok.
 *
 * El limitador devuelve `invalid` en lugar de un error propio para no dar
 * pistas sobre qué direcciones existen a quien pruebe tokens en masa.
 */
export async function unsubscribeByToken(
  email: string,
  token: string,
): Promise<{ ok: true } | { error: 'invalid' | 'server_error' }> {
  const normalised = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalised)) return { error: 'invalid' }

  const h = await headers()
  const rl = await rateLimit(rateLimitKey([getClientIp(h), 'unsubscribe']), 20, 60 * 60 * 1000)
  if (!rl.ok) return { error: 'invalid' }

  if (!verifyUnsubscribeToken(normalised, token)) return { error: 'invalid' }

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', normalised)

  if (error) {
    console.error('[unsubscribe] db error', { message: error.message })
    return { error: 'server_error' }
  }

  return { ok: true }
}
