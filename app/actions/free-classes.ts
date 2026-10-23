'use server'

import { randomUUID } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { after } from 'next/server'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'
import { isDemoMode } from '@/utils/demo/mode'
import { normaliseEmail, upsertSubscriber } from '@/utils/newsletter/subscribe'
import { sendFreeClassesEmail } from '@/utils/email/free-classes'
import { recordServerEvent } from '@/utils/analytics/server-event'
import { FREE_CLASS_LEAD_PATH } from '@/utils/analytics/tracked-paths'
import { collectAttribution } from '@/utils/analytics/meta-attribution'
import { sendLeadToMeta } from '@/utils/analytics/meta-capi'
import { CONSENT_COOKIE, parseConsent } from '@/utils/consent/categories'

export type FreeClassesError = 'rate_limit' | 'invalid_email' | 'consent_required' | 'server_error'

/**
 * Formulario «¿Te ha gustado? Te mandamos dos clases más» de la landing.
 *
 * 1. Alta en `newsletter_subscribers` con origen `clase_gratis`, que es lo que
 *    mete a la persona en la secuencia de nutrición del cron.
 * 2. Primer email de la secuencia en el acto, con el enlace a las dos clases.
 * 3. Evento `/curso-bachatango/lead` para el panel, y `Lead` para Meta por la
 *    API de conversiones si hay consentimiento de marketing. El `eventId` se
 *    devuelve al navegador para que el píxel mande el mismo y Meta deduplique.
 *
 * La casilla de consentimiento es obligatoria también aquí, no solo en el
 * HTML: el alta es para recibir emails comerciales (LSSI art. 21).
 */
export async function requestFreeClasses(
  formData: FormData,
): Promise<{ success: true; eventId: string } | { error: FreeClassesError }> {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'free-classes']), 5, 60 * 60 * 1000)
  if (!rl.ok) return { error: 'rate_limit' }

  const email = normaliseEmail(formData.get('email'))
  if (!email) return { error: 'invalid_email' }
  if (formData.get('consent') !== 'on') return { error: 'consent_required' }

  if (!(await upsertSubscriber({ email, ip, source: 'clase_gratis' }))) {
    return { error: 'server_error' }
  }

  // Un fallo del email no deshace el alta, que ya está guardada.
  const sent = await sendFreeClassesEmail(email)
  if (!sent) console.error('[requestFreeClasses] el primer email no salió')

  const userAgent = h.get('user-agent')
  await recordServerEvent(FREE_CLASS_LEAD_PATH, ip, userAgent)

  const eventId = randomUUID()
  const ck = await cookies()
  const consent = parseConsent(ck.get(CONSENT_COOKIE)?.value)
  if (consent?.marketing === true) {
    const attribution = collectAttribution({
      fbpCookie: ck.get('_fbp')?.value,
      fbcCookie: ck.get('_fbc')?.value,
      ip,
      userAgent,
      marketingConsent: true,
      nowMs: Date.now(),
    })
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'
    // Después de responder: la llamada a Meta puede tardar hasta 5 s y quien
    // acaba de apuntarse no tiene por qué esperarla.
    after(() => sendLeadToMeta(
      { eventId, eventTime: Date.now() / 1000, eventSourceUrl: `${origin}/curso-bachatango`, email, attribution },
      { isDemo: isDemoMode() },
    ))
  }

  return { success: true, eventId }
}
