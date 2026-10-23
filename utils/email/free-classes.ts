import 'server-only'
import { ENTITY } from '@/utils/legal/entity'
import { makeFreeClassesToken } from '@/utils/newsletter/free-classes-token'
import { renderEmail, renderTexto, enviar } from './layout'
import { pieDeBaja } from './unsubscribe-footer'

/**
 * Paso 1 de la secuencia de nutrición: entrega las dos clases que se piden en
 * el formulario de la landing (app/actions/free-classes.ts). Sale en el acto,
 * desde la propia acción; los pasos siguientes los manda el cron.
 *
 * Es comunicación comercial: lleva pie de baja y List-Unsubscribe, y no se
 * envía sin NEWSLETTER_UNSUBSCRIBE_SECRET. Las respuestas van al email de
 * contacto de la entidad, no al noreply: estos correos invitan a contestar
 * (decisión del usuario, 2026-10-23).
 *
 * Devuelve si Resend aceptó el correo. No lanza.
 */
export async function sendFreeClassesEmail(email: string): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'
  const pie = pieDeBaja(
    email,
    `Recibes este correo porque pediste las clases gratis en ${base.replace(/^https?:\/\//, '')}.`,
  )
  const token = makeFreeClassesToken(email)
  if (!pie || !token) {
    console.error('[free-classes] NEWSLETTER_UNSUBSCRIBE_SECRET unset, refusing to send')
    return false
  }

  const titulo = 'Aquí tienes tus dos clases'
  const parrafos = [
    'Gracias por apuntarte. Como te prometimos, aquí tienes dos clases más del CURSO BACHATANGO: la de posturas y la del segundo básico, el cuadrado.',
    'Empieza por la de posturas: es la base de todo lo demás. Si te surge cualquier duda, responde a este correo.',
  ]
  const boton = {
    texto: 'Ver mis dos clases',
    url: `${base}/clase-gratis/mas?e=${encodeURIComponent(email)}&t=${token}`,
  }

  return enviar({
    to: email,
    subject: 'Tus dos clases de bachatango',
    html: renderEmail({
      preheader: 'Posturas y segundo básico, para practicar en casa.',
      titulo,
      parrafos,
      boton,
      pieExtra: pie.html,
    }),
    text: renderTexto({ titulo, parrafos, boton, pieExtra: pie.text }),
    headers: pie.headers,
    replyTo: ENTITY.email,
    etiqueta: 'free-classes',
  })
}
