import 'server-only'
import { createSupabaseAdmin } from '@/utils/supabase/admin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Email del formulario en minúsculas y sin espacios, o null si no es válido. */
export function normaliseEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase()
  return EMAIL_RE.test(email) ? email : null
}

/**
 * De dónde llegó el consentimiento. Decide qué recibe la persona: solo
 * `clase_gratis` entra en la secuencia de nutrición (app/api/cron/lifecycle-emails).
 */
export type ConsentSource = 'newsletter_form' | 'clase_gratis'

/**
 * Alta o reactivación en `newsletter_subscribers` con la prueba de
 * consentimiento (RGPD art. 7.1): IP, fecha y origen.
 *
 * Sin `ignoreDuplicates`: quien se dio de baja y vuelve está dando un
 * consentimiento nuevo y debe reactivarse. Por la misma razón el origen y la
 * fecha se sobrescriben con los del último formulario.
 */
export async function upsertSubscriber(opts: {
  email: string
  ip: string
  source: ConsentSource
}): Promise<boolean> {
  const { error } = await createSupabaseAdmin()
    .from('newsletter_subscribers')
    .upsert(
      {
        email: opts.email,
        consent_ip: opts.ip,
        consent_at: new Date().toISOString(),
        consent_source: opts.source,
        unsubscribed_at: null,
      },
      { onConflict: 'email' },
    )
    .select('email')

  if (error) {
    console.error('[upsertSubscriber] db error', { source: opts.source, code: error.code, message: error.message })
    return false
  }
  return true
}
