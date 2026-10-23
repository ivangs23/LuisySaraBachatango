import 'server-only'
import { renderEmail, renderTexto, enviar } from './layout'
import { pieDeBaja } from './unsubscribe-footer'

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

  const pie = pieDeBaja(
    opts.email,
    `Recibes este correo porque te suscribiste en ${BASE.replace(/^https?:\/\//, '')}.`,
  )
  if (!pie) {
    console.error('[newsletter-welcome] NEWSLETTER_UNSUBSCRIBE_SECRET unset, refusing to send')
    return
  }

  const titulo = 'Tu clase gratis, como te prometimos'
  const parrafos = [
    'Gracias por suscribirte. Aquí tienes una clase completa del curso, sin registro y sin condiciones.',
    'De vez en cuando te escribiremos con consejos de técnica, novedades y fechas de talleres. Nada más, y puedes salirte cuando quieras.',
  ]
  const boton = { texto: 'Ver la clase gratis', url: `${BASE}/clase-gratis` }

  const html = renderEmail({
    preheader: 'Una clase completa del curso, gratis y sin registro.',
    titulo,
    parrafos,
    boton,
    pieExtra: pie.html,
  })
  const text = renderTexto({ titulo, parrafos, boton, pieExtra: pie.text })

  await enviar({
    to: opts.email,
    subject: 'Tu clase gratis de Bachatango',
    html,
    text,
    headers: pie.headers,
    etiqueta: 'newsletter-welcome',
  })
}
