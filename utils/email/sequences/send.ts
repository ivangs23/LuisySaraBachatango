import 'server-only'
import { ENTITY } from '@/utils/legal/entity'
import { renderEmail, renderTexto, enviar } from '../layout'
import { pieDeBaja } from '../unsubscribe-footer'
import type { StepContent } from './types'

/**
 * Envía un paso de la secuencia de nutrición. Es comunicación comercial: pie
 * de baja y List-Unsubscribe, y sin NEWSLETTER_UNSUBSCRIBE_SECRET no sale.
 * Las respuestas van al email de contacto, no al noreply: estos correos
 * invitan a contestar.
 *
 * Devuelve si Resend aceptó el correo. No lanza.
 */
export async function sendStepContent(email: string, content: StepContent, etiqueta: string): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'
  const pie = pieDeBaja(
    email,
    `Recibes este correo porque pediste las clases gratis en ${base.replace(/^https?:\/\//, '')}.`,
  )
  if (!pie) {
    console.error(`[${etiqueta}] NEWSLETTER_UNSUBSCRIBE_SECRET unset, refusing to send`)
    return false
  }

  const { subject, preheader, titulo, parrafos, boton } = content
  return enviar({
    to: email,
    subject,
    html: renderEmail({ preheader, titulo, parrafos, boton, pieExtra: pie.html }),
    text: renderTexto({ titulo, parrafos, boton, pieExtra: pie.text }),
    headers: pie.headers,
    replyTo: ENTITY.email,
    etiqueta,
  })
}
