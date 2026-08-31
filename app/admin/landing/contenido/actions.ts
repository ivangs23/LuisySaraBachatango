'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { parseStatsForm, parseTestimonialForm, parseFaqForm } from './_lib/parse'

const ADMIN_PATH = '/admin/landing/contenido'

async function ensureAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'No autorizado' }
  }
}

/**
 * Revalida donde se ve el contenido, para que el cambio salga al momento en
 * lugar de esperar los 5 minutos de ISR. La OG image entra en la lista porque
 * también pinta las cifras y se regenera por ISR.
 */
function revalidateLanding(): void {
  revalidatePath('/')
  revalidatePath('/sobre-nosotros')
  revalidatePath('/opengraph-image')
  revalidatePath(ADMIN_PATH)
}

export async function updateStats(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseStatsForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase.from('landing_stats').upsert(
    parsed.payload.map((p, i) => ({ ...p, position: i + 1, updated_at: new Date().toISOString() })),
    { onConflict: 'key' },
  )

  if (error) {
    console.error('[updateStats] failed', error)
    return { error: error.message }
  }

  revalidateLanding()
}

export async function upsertTestimonial(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseTestimonialForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase.from('landing_testimonials').upsert(parsed.payload)

  if (error) {
    console.error('[upsertTestimonial] failed', error)
    return { error: error.message }
  }

  revalidateLanding()
}

export async function deleteTestimonial(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Falta el identificador' }

  const supabase = await createClient()
  const { error } = await supabase.from('landing_testimonials').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidateLanding()
}

export async function upsertFaqItem(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseFaqForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase.from('landing_faq').upsert(parsed.payload)

  if (error) {
    console.error('[upsertFaqItem] failed', error)
    return { error: error.message }
  }

  revalidateLanding()
}

export async function deleteFaqItem(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Falta el identificador' }

  const supabase = await createClient()
  const { error } = await supabase.from('landing_faq').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidateLanding()
}
