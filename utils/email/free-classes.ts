import 'server-only'
import { NUTRICION } from './sequences/nutricion'
import { sendStepContent } from './sequences/send'

/**
 * Paso 1 de la secuencia de nutrición: entrega las dos clases que se piden en
 * el formulario de la landing (app/actions/free-classes.ts). Sale en el acto,
 * desde la propia acción; los pasos siguientes los manda el cron.
 *
 * El texto vive con el resto de la secuencia (sequences/nutricion.ts). Sin
 * NEWSLETTER_UNSUBSCRIBE_SECRET no hay enlace a las clases ni de baja, y no
 * se envía.
 *
 * Devuelve si Resend aceptó el correo. No lanza.
 */
export async function sendFreeClassesEmail(email: string): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'
  const content = NUTRICION.steps[0].content({ email, base, curriculum: null, price: null })
  if (!content) {
    console.error('[free-classes] NEWSLETTER_UNSUBSCRIBE_SECRET unset, refusing to send')
    return false
  }
  return sendStepContent(email, content, 'free-classes')
}
