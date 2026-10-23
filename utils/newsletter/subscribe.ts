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
 * consentimiento nuevo y debe reactivarse (`unsubscribed_at` a null, IP y
 * fecha del último formulario).
 *
 * El origen, en cambio, no siempre se pisa: la newsletter de la home nunca
 * sobrescribe `clase_gratis`. Si lo hiciera, quien entró por la clase gratis
 * y después se suscribe en la home saldría de la secuencia de nutrición sin
 * haberlo pedido. Al revés sí: pedir las clases es justo el consentimiento
 * para esa secuencia.
 */
export async function upsertSubscriber(opts: {
  email: string
  ip: string
  source: ConsentSource
}): Promise<boolean> {
  const sb = createSupabaseAdmin()

  let source = opts.source
  if (source !== 'clase_gratis') {
    const { data: actual, error: readErr } = await sb
      .from('newsletter_subscribers')
      .select('consent_source')
      .eq('email', opts.email)
      .maybeSingle()
    // Sin saber el origen actual, escribir podría sacar a alguien de la
    // secuencia: mejor fallar y que reintente.
    if (readErr) {
      console.error('[upsertSubscriber] read error', { code: readErr.code, message: readErr.message })
      return false
    }
    if ((actual as { consent_source?: string } | null)?.consent_source === 'clase_gratis') source = 'clase_gratis'
  }

  const { error } = await sb
    .from('newsletter_subscribers')
    .upsert(
      {
        email: opts.email,
        consent_ip: opts.ip,
        consent_at: new Date().toISOString(),
        consent_source: source,
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
