'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { hasCourseAccess } from '@/utils/auth/course-access'
import {
  CERTIFICATE_CODE_BYTES,
  generateCertificateCode,
  normalizeRecipientName,
} from '@/utils/courses/completion'

export type IssueCompletionResult =
  | { ok: true; alreadyIssued: boolean }
  | { ok: false; error: 'unauthenticated' | 'forbidden' | 'invalid_name' | 'no_lessons' | 'incomplete' | 'db_error'; remaining?: number }

const CODE_RETRIES = 5

/**
 * Emite el certificado de aprovechamiento del curso para quien llama.
 *
 * Toda la decisión es de servidor. El botón de la ficha se deshabilita hasta el
 * 100 %, pero eso es sólo UX: aquí se vuelve a contar, con el service role, las
 * lecciones del curso y las que este usuario tiene marcadas como completadas, y
 * si no coinciden se rechaza. El cliente sólo aporta el nombre a imprimir.
 *
 * Se cuenta con el service role a propósito: la RLS del paywall sobre `lessons`
 * sólo deja ver las gratuitas a quien no ha comprado, así que contar con la
 * sesión del usuario daría un total menor que el real y un 100 % falso. Ningún
 * dato de lección sale de esta función: sólo números.
 *
 * Idempotente: si ya hay fila, se devuelve `alreadyIssued` y no se toca nada —
 * ni el nombre ni la fecha de un documento ya expedido deben cambiar.
 */
export async function issueCompletion(
  courseId: string,
  recipientNameRaw: string,
): Promise<IssueCompletionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  if (!(await hasCourseAccess(user.id, courseId))) {
    return { ok: false, error: 'forbidden' }
  }

  const recipientName = normalizeRecipientName(recipientNameRaw)
  if (!recipientName) return { ok: false, error: 'invalid_name' }

  const admin = createSupabaseAdmin()

  // Ya emitido: devolver sin tocar la fila existente.
  const { data: existing, error: existingError } = await admin
    .from('course_completions')
    .select('certificate_code')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()

  if (existingError) {
    console.error('issueCompletion: lookup failed', existingError)
    return { ok: false, error: 'db_error' }
  }
  if (existing) return { ok: true, alreadyIssued: true }

  // Recuento real: lecciones del curso vs lecciones completadas por este usuario.
  const { data: lessonRows, error: lessonsError } = await admin
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)

  if (lessonsError) {
    console.error('issueCompletion: lessons count failed', lessonsError)
    return { ok: false, error: 'db_error' }
  }

  const lessonIds = (lessonRows ?? []).map((l) => l.id as string)
  if (lessonIds.length === 0) return { ok: false, error: 'no_lessons' }

  const { count: completedCount, error: progressError } = await admin
    .from('lesson_progress')
    .select('lesson_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_completed', true)
    .in('lesson_id', lessonIds)

  if (progressError) {
    console.error('issueCompletion: progress count failed', progressError)
    return { ok: false, error: 'db_error' }
  }

  const completed = completedCount ?? 0
  if (completed < lessonIds.length) {
    return { ok: false, error: 'incomplete', remaining: lessonIds.length - completed }
  }

  // Código único. El índice único de `certificate_code` es la autoridad; el
  // bucle sólo cubre la colisión improbable (32^4 combinaciones por año).
  const year = new Date().getUTCFullYear()
  for (let attempt = 0; attempt < CODE_RETRIES; attempt++) {
    const code = generateCertificateCode(year, randomBytes(CERTIFICATE_CODE_BYTES))
    const { error: insertError } = await admin
      .from('course_completions')
      .insert({
        user_id: user.id,
        course_id: courseId,
        certificate_code: code,
        recipient_name: recipientName,
        lessons_total: lessonIds.length,
      })

    if (!insertError) {
      revalidatePath(`/courses/${courseId}`)
      revalidatePath(`/courses/${courseId}/certificado`)
      return { ok: true, alreadyIssued: false }
    }

    // 23505 = unique_violation. Puede ser el código (reintentar) o la PK
    // (otra pestaña emitió a la vez: ya está hecho).
    if (insertError.code === '23505') {
      if (insertError.message?.includes('course_completions_pkey')) {
        return { ok: true, alreadyIssued: true }
      }
      continue
    }

    console.error('issueCompletion: insert failed', insertError)
    return { ok: false, error: 'db_error' }
  }

  console.error('issueCompletion: no se pudo generar un código único')
  return { ok: false, error: 'db_error' }
}
