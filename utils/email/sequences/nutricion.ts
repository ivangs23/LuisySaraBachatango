import 'server-only'
import { makeFreeClassesToken } from '@/utils/newsletter/free-classes-token'
import type { Sequence, StepContext } from './types'

/**
 * Secuencia de nutrición: quien deja su email en la landing a cambio de dos
 * clases (T3.1) recibe seis correos en dos semanas y sale al comprar o al
 * darse de baja (plan de marketing, T3.3).
 *
 * ⚠️ BORRADORES. Los textos los revisan Luis y Sara antes de activar el cron
 * en producción (LIFECYCLE_EMAILS_ENABLED=1). El paso 2 sobre todo: es un
 * consejo de técnica y tienen que escribirlo ellos.
 *
 * Regla 9 del plan, nada inventado: los datos (temario, precio, trayectoria)
 * salen de la BD o de lo ya confirmado; el paso 4 espera un testimonio real y
 * hasta entonces se salta. Sin urgencias ni escasez.
 *
 * El paso 1 lo manda la Server Action del formulario en el acto
 * (utils/email/free-classes.ts); el cron empieza en el 2.
 */

const curso = (ctx: StepContext) => ({ texto: 'Ver el curso', url: `${ctx.base}/curso-bachatango` })

export const NUTRICION: Sequence = {
  name: 'nutricion',
  steps: [
    {
      step: 1,
      delayDays: 0,
      content: (ctx) => {
        const token = makeFreeClassesToken(ctx.email)
        if (!token) return null
        return {
          subject: 'Tus dos clases de bachatango',
          preheader: 'Posturas y segundo básico, para practicar en casa.',
          titulo: 'Aquí tienes tus dos clases',
          parrafos: [
            'Gracias por apuntarte. Como te prometimos, aquí tienes dos clases más del CURSO BACHATANGO: la de posturas y la del segundo básico, el cuadrado.',
            'Empieza por la de posturas: es la base de todo lo demás. Si te surge cualquier duda, responde a este correo.',
          ],
          boton: {
            texto: 'Ver mis dos clases',
            url: `${ctx.base}/clase-gratis/mas?e=${encodeURIComponent(ctx.email)}&t=${token}`,
          },
        }
      },
    },
    {
      // BORRADOR: el consejo concreto lo escriben Luis y Sara.
      step: 2,
      delayDays: 2,
      content: (ctx) => ({
        subject: 'El detalle que cambia tu abrazo',
        preheader: 'Un ejercicio de cinco minutos para hacer hoy.',
        titulo: 'El detalle que cambia tu abrazo',
        parrafos: [
          'En bachatango, casi todo lo que le transmites a tu pareja pasa por el abrazo. Y el abrazo empieza antes de tocar a nadie: en tu propia postura.',
          'Prueba esto hoy, cinco minutos: pon una canción que te guste, colócate como en la clase de posturas y camina a ritmo sin perder esa postura. Si se te cae al cambiar de dirección, ya sabes qué trabajar esta semana.',
        ],
        boton: curso(ctx),
      }),
    },
    {
      step: 3,
      delayDays: 4,
      content: (ctx) => ({
        subject: 'Bailamos juntos desde los 9 años',
        preheader: 'De la primera clase de baile a la final de Bailando con las Estrellas.',
        titulo: 'Bailamos juntos desde los 9 años',
        parrafos: [
          'Nos conocimos con 9 años, el primer día de clase de baile, allá por 2002. Desde entonces no hemos dejado de bailar juntos.',
          'Sara es licenciada en Pedagogía de la Danza y Luis es Juez Nacional de Baile Deportivo. Hemos bailado junto a Il Divo, Gente de Zona y Diego Torres, en galas como los Premios Platino, y en 2024 llegamos los dos a la final de la primera edición de Bailando con las Estrellas, que ganó Luis.',
          'En 2020 abrimos nuestra propia escuela. El CURSO BACHATANGO es nuestro método, ordenado módulo a módulo para que puedas aprenderlo desde casa.',
        ],
        boton: curso(ctx),
      }),
    },
    {
      // PENDIENTE: caso real de un alumno, con su permiso. Hasta que lo haya,
      // este paso se salta y la secuencia sigue con el 5.
      step: 4,
      delayDays: 7,
      content: () => null,
    },
    {
      step: 5,
      delayDays: 10,
      content: (ctx) => ({
        subject: '¿Y si no tengo pareja?',
        preheader: 'La pregunta que más nos hacen.',
        titulo: '¿Y si no tengo pareja?',
        parrafos: [
          'Es la pregunta que más nos hacen. La respuesta corta: puedes empezar sin pareja.',
          'El curso enseña tanto el rol de leader como el de follower, y la postura, la técnica y la musicalidad se practican igual de bien a solas. Cuando tengas con quién bailar, ya sabrás qué hacer.',
          'Si tienes cualquier otra duda, responde a este correo.',
        ],
        boton: curso(ctx),
      }),
    },
    {
      step: 6,
      delayDays: 14,
      content: (ctx) => {
        // Cifras y precio reales o nada: sin ellos, mañana se reintenta.
        if (!ctx.curriculum || ctx.price === null) return null
        const { modules, lessons, duration } = ctx.curriculum
        return {
          subject: `El curso completo, ${lessons} lecciones`,
          preheader: 'Desde las dos clases que ya tienes hasta la demostración final.',
          titulo: 'El curso completo',
          parrafos: [
            `Si las dos clases te han servido, el curso completo sigue desde ahí: ${modules} módulos y ${lessons} lecciones en vídeo, ${duration} en total, con el resto de básicos y las combinaciones, cada una explicada y después bailada con música.`,
            `Es un pago único de ${ctx.price} €, con acceso de por vida desde el móvil o el ordenador y certificado al completarlo.`,
          ],
          boton: { texto: 'Ver el curso completo', url: `${ctx.base}/curso-bachatango` },
        }
      },
    },
  ],
}
