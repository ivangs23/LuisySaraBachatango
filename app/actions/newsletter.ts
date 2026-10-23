'use server'

import { headers } from 'next/headers'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'
import { sendNewsletterWelcome } from '@/utils/email/newsletter-welcome'
import { normaliseEmail, upsertSubscriber } from '@/utils/newsletter/subscribe'

export async function subscribeNewsletter(formData: FormData): Promise<{ success: true } | { error: string }> {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'newsletter']), 5, 60 * 60 * 1000)
  if (!rl.ok) return { error: 'rate_limit' }

  const email = normaliseEmail(formData.get('email'))
  if (!email) return { error: 'invalid_email' }

  // Reactiva a quien se dio de baja y vuelve (ver upsertSubscriber).
  if (!(await upsertSubscriber({ email, ip, source: 'newsletter_form' }))) {
    return { error: 'server_error' }
  }

  // El email nunca puede tumbar la suscripción: ya está comprometida en BD.
  try {
    await sendNewsletterWelcome({ email })
  } catch (e) {
    console.error('[subscribeNewsletter] welcome email failed', e)
  }

  return { success: true }
}
