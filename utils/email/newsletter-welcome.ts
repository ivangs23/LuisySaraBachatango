import 'server-only'
import { makeUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'

const FROM = 'Luis y Sara Bachatango <noreply@luisysarabachatango.com>'
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/**
 * Email de bienvenida. Entrega la clase gratis que promete el copy de la
 * newsletter e incluye el enlace de baja obligatorio (LSSI art. 21).
 *
 * Nunca lanza: un fallo de email no puede tumbar la suscripción, que ya está
 * comprometida en base de datos. No-op si falta RESEND_API_KEY.
 *
 * No-op también si falta NEWSLETTER_UNSUBSCRIBE_SECRET: sin enlace de baja no
 * se puede enviar comunicación comercial legalmente, así que es preferible no
 * enviar nada que enviar un email no conforme.
 */
export async function sendNewsletterWelcome(opts: { email: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) return

  const token = makeUnsubscribeToken(opts.email)
  if (!token) {
    console.error('[newsletter-welcome] NEWSLETTER_UNSUBSCRIBE_SECRET unset, refusing to send')
    return
  }

  const unsubUrl = `${BASE}/unsubscribe?email=${encodeURIComponent(opts.email)}&token=${token}`
  const html = `
    <h2>Bienvenido/a a la comunidad</h2>
    <p>Gracias por suscribirte. Como te prometimos, aquí tienes una clase completa del curso, gratis y sin condiciones:</p>
    <p><a href="${BASE}/clase-gratis">Ver la clase gratis</a></p>
    <p>De vez en cuando te escribiremos con consejos de técnica, novedades y fechas de talleres. Nada más.</p>
    <hr>
    <p style="font-size:12px;color:#888">
      Si no quieres volver a recibir nuestros emails,
      <a href="${esc(unsubUrl)}">date de baja aquí</a>.
    </p>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [opts.email],
        subject: 'Tu clase gratis de Bachatango',
        html,
      }),
    })
    if (!res.ok) {
      console.error('[newsletter-welcome] resend failed', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.error('[newsletter-welcome] resend threw', e)
  }
}
