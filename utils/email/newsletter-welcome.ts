import 'server-only'
import { makeUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'
import { renderEmail, renderTexto, enviar, esc } from './layout'

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'

/**
 * Email de bienvenida. Entrega la clase gratis que promete el copy de la
 * newsletter e incluye el enlace de baja obligatorio (LSSI art. 21).
 *
 * Nunca lanza: un fallo de email no puede tumbar la suscripción, que ya está
 * comprometida en base de datos. No hace nada si falta RESEND_API_KEY.
 *
 * Tampoco envía si falta NEWSLETTER_UNSUBSCRIBE_SECRET: sin enlace de baja no
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

  const titulo = 'Tu clase gratis, como te prometimos'
  const parrafos = [
    'Gracias por suscribirte. Aquí tienes una clase completa del curso, sin registro y sin condiciones.',
    'De vez en cuando te escribiremos con consejos de técnica, novedades y fechas de talleres. Nada más, y puedes salirte cuando quieras.',
  ]
  const boton = { texto: 'Ver la clase gratis', url: `${BASE}/clase-gratis` }

  const pieHtml = `<p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8b857c;">
      Recibes este correo porque te suscribiste en ${esc(BASE.replace(/^https?:\/\//, ''))}.
      <a href="${esc(unsubUrl)}" style="color:#8b857c;">Darse de baja</a>.
    </p>`
  const pieTexto = `Recibes este correo porque te suscribiste. Darse de baja: ${unsubUrl}`

  const html = renderEmail({
    preheader: 'Una clase completa del curso, gratis y sin registro.',
    titulo,
    parrafos,
    boton,
    pieExtra: pieHtml,
  })
  const text = renderTexto({ titulo, parrafos, boton, pieExtra: pieTexto })

  await enviar({
    to: opts.email,
    subject: 'Tu clase gratis de Bachatango',
    html,
    text,
    // RFC 8058: permite a Gmail y Outlook mostrar su propio botón de baja
    // junto al remitente. Reduce mucho las marcas de spam, porque quien no
    // quiere seguir se da de baja en vez de denunciar el correo.
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    etiqueta: 'newsletter-welcome',
  })
}
