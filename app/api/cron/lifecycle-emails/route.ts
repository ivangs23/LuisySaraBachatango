import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { alertaCritica, avisoAuth } from '@/utils/alerta'
import { getCurriculum, formatDuration } from '@/utils/courses/curriculum'
import { getLandingCourse } from '@/utils/courses/landing-course'
import { NUTRICION } from '@/utils/email/sequences/nutricion'
import { daysSince, pendingSteps } from '@/utils/email/sequences/engine'
import {
  claimSend, loadBuyerEmails, loadNurtureSubscribers, loadSentSteps, releaseSend,
} from '@/utils/email/sequences/store'
import { sendStepContent } from '@/utils/email/sequences/send'
import type { StepContext } from '@/utils/email/sequences/types'

export const dynamic = 'force-dynamic'

/** Tope por ejecución: acota el coste y el daño si algo se tuerce. */
const MAX_ENVIOS = 200
/** El paso 1 lo manda el formulario en el acto (app/actions/free-classes.ts). */
const PRIMER_PASO = 2

function autorizado(req: Request): { ok: boolean; secretoConfigurado: boolean } {
  const secret = process.env.CRON_SECRET
  const a = Buffer.from(req.headers.get('authorization') ?? '')
  const b = Buffer.from(`Bearer ${secret}`)
  return { ok: !!secret && a.length === b.length && timingSafeEqual(a, b), secretoConfigurado: !!secret }
}

/**
 * Secuencia de nutrición, una vez al día (vercel.json). Para cada suscriptor
 * con origen `clase_gratis` que no se ha dado de baja ni ha comprado, manda
 * como mucho UN correo: el primer paso pendiente que ya le toque por días
 * desde el alta y tenga contenido.
 *
 * Garantías:
 * - Sin LIFECYCLE_EMAILS_ENABLED=1 no envía nada (los textos los revisan Luis
 *   y Sara antes de activarlo).
 * - Apunta el envío en `email_sends` ANTES de mandarlo: dos ejecuciones
 *   solapadas no duplican. Si el envío falla, borra el apunte y mañana se
 *   reintenta.
 * - Si no puede leer qué se envió ya (p. ej. la tabla aún no existe), no
 *   envía nada: 500 y aviso.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const auth = autorizado(req)
  if (!auth.ok) {
    avisoAuth('Cron de emails rechazado: la secuencia de nutrición deja de enviarse', {
      secretoConfigurado: auth.secretoConfigurado,
    })
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (process.env.LIFECYCLE_EMAILS_ENABLED !== '1') {
    return NextResponse.json({ ok: true, enabled: false })
  }

  let subscribers: Awaited<ReturnType<typeof loadNurtureSubscribers>>
  let buyers: Set<string>
  let enviados: Map<string, Set<number>>
  try {
    ;[subscribers, buyers, enviados] = await Promise.all([
      loadNurtureSubscribers(),
      loadBuyerEmails(),
      loadSentSteps(NUTRICION.name),
    ])
  } catch (e) {
    alertaCritica('Cron de emails: no se pudo leer el estado, no se envía nada', {
      motivo: (e as Error).message,
    })
    return new NextResponse('Error', { status: 500 })
  }

  const [curriculum, course] = await Promise.all([getCurriculum(), getLandingCourse()])
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'
  const ctxBase: Omit<StepContext, 'email'> = {
    base,
    curriculum: curriculum
      ? { modules: curriculum.moduleCount, lessons: curriculum.lessonCount, duration: formatDuration(curriculum.totalSeconds) }
      : null,
    price: course?.price_eur ?? null,
  }

  const now = new Date()
  let sent = 0
  let failed = 0

  for (const sub of subscribers) {
    if (sent + failed >= MAX_ENVIOS) break
    if (buyers.has(sub.email)) continue

    const ctx: StepContext = { ...ctxBase, email: sub.email }
    const candidatos = pendingSteps(
      NUTRICION.steps,
      enviados.get(sub.email) ?? new Set(),
      daysSince(sub.consentAt, now),
      PRIMER_PASO,
    )

    for (const paso of candidatos) {
      const content = paso.content(ctx)
      if (!content) continue // falta material o un dato: se prueba con el siguiente

      // 'taken': otra ejecución se adelantó. 'error': mañana se reintenta.
      if ((await claimSend(sub.email, NUTRICION.name, paso.step)) !== 'claimed') break

      if (await sendStepContent(sub.email, content, `nutricion-${paso.step}`)) {
        sent++
      } else {
        failed++
        await releaseSend(sub.email, NUTRICION.name, paso.step)
      }
      break // un correo por persona y ejecución
    }
  }

  // Un solo aviso por ejecución: si Resend se cae, 200 avisos no ayudan.
  if (failed > 0) {
    alertaCritica('Cron de emails: envíos fallidos, se reintentan mañana', { sent, failed })
  }

  return NextResponse.json({ ok: true, enabled: true, sent, failed })
}
