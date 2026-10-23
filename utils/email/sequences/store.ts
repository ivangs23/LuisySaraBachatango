import 'server-only'
import { createSupabaseAdmin } from '@/utils/supabase/admin'

/**
 * Acceso a datos del motor de secuencias, todo con service role: lo usa el
 * cron, que no tiene sesión. Las lecturas LANZAN si la BD falla: el cron
 * prefiere no enviar nada a enviar sin saber qué se mandó ya.
 */

export type Subscriber = { email: string; consentAt: Date }

/** Quien pidió las clases gratis y sigue suscrito. */
export async function loadNurtureSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await createSupabaseAdmin()
    .from('newsletter_subscribers')
    .select('email, consent_at')
    .eq('consent_source', 'clase_gratis')
    .is('unsubscribed_at', null)

  if (error || !data) throw new Error(`[sequences] suscriptores: ${error?.message ?? 'sin datos'}`)

  return (data as { email: string; consent_at: string | null }[])
    .filter((r) => !!r.consent_at)
    .map((r) => ({ email: r.email.trim().toLowerCase(), consentAt: new Date(r.consent_at!) }))
}

/**
 * Emails de quien ya tiene una compra: salen de la secuencia de nutrición,
 * que termina vendiendo el curso. Por `profiles.email` porque las compras
 * van por `user_id`.
 */
export async function loadBuyerEmails(): Promise<Set<string>> {
  const sb = createSupabaseAdmin()
  const { data: compras, error } = await sb.from('course_purchases').select('user_id')
  if (error || !compras) throw new Error(`[sequences] compras: ${error?.message ?? 'sin datos'}`)

  const ids = [...new Set((compras as { user_id: string | null }[]).map((c) => c.user_id).filter(Boolean))] as string[]
  if (ids.length === 0) return new Set()

  const { data: perfiles, error: perr } = await sb.from('profiles').select('email').in('id', ids)
  if (perr || !perfiles) throw new Error(`[sequences] perfiles: ${perr?.message ?? 'sin datos'}`)

  return new Set(
    (perfiles as { email: string | null }[])
      .map((p) => p.email?.trim().toLowerCase())
      .filter((e): e is string => !!e),
  )
}

/** Pasos ya enviados de una secuencia, por email. */
export async function loadSentSteps(sequence: string): Promise<Map<string, Set<number>>> {
  const { data, error } = await createSupabaseAdmin()
    .from('email_sends')
    .select('email, step')
    .eq('sequence', sequence)

  if (error || !data) throw new Error(`[sequences] email_sends: ${error?.message ?? 'sin datos'}`)

  const out = new Map<string, Set<number>>()
  for (const r of data as { email: string; step: number }[]) {
    const set = out.get(r.email) ?? new Set<number>()
    set.add(r.step)
    out.set(r.email, set)
  }
  return out
}

/**
 * Apunta el envío ANTES de hacerlo. El `unique (email, sequence, step)` es el
 * cerrojo: si otra ejecución solapada se adelantó, el insert falla con 23505
 * y esta no envía.
 */
export async function claimSend(
  email: string,
  sequence: string,
  step: number,
): Promise<'claimed' | 'taken' | 'error'> {
  const { error } = await createSupabaseAdmin().from('email_sends').insert({ email, sequence, step })
  if (!error) return 'claimed'
  if (error.code === '23505') return 'taken'
  console.error('[sequences] no se pudo apuntar el envío', { sequence, step, message: error.message })
  return 'error'
}

/** Deshace el apunte de un envío que falló, para reintentarlo mañana. */
export async function releaseSend(email: string, sequence: string, step: number): Promise<void> {
  const { error } = await createSupabaseAdmin()
    .from('email_sends')
    .delete()
    .eq('email', email)
    .eq('sequence', sequence)
    .eq('step', step)
  if (error) console.error('[sequences] no se pudo liberar el envío', { sequence, step, message: error.message })
}
