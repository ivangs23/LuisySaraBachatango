import 'server-only'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import type { Locale } from '@/utils/i18n/types'
import { pickLocalized } from './locale-text'
import { FALLBACK_STATS, FALLBACK_TESTIMONIALS, FALLBACK_FAQ } from './fallbacks'

export type LandingStats = Record<'years' | 'students' | 'countries' | 'titles', string>
export type Testimonial = { id: string; name: string; quote: string; stars: number }
export type FaqItem = { id: string; question: string; answer: string }

/**
 * Cifras del hero y de «Sobre nosotros». Devuelve el número pelado ('25'):
 * cada vista le pone su '+' delante o detrás.
 *
 * Cualquier clave que falte en la tabla se rellena con el valor de código, así
 * que el resultado siempre trae las cuatro.
 */
export async function getLandingStats(): Promise<LandingStats> {
  try {
    const { data, error } = await createSupabaseAdmin()
      .from('landing_stats')
      .select('key, value')
      .order('position', { ascending: true })

    if (error || !data) return { ...FALLBACK_STATS }

    const out: LandingStats = { ...FALLBACK_STATS }
    for (const row of data as { key: string; value: string }[]) {
      if (row.key in out && typeof row.value === 'string' && row.value.length > 0) {
        out[row.key as keyof LandingStats] = row.value
      }
    }
    return out
  } catch {
    return { ...FALLBACK_STATS }
  }
}

export async function getTestimonials(locale: Locale): Promise<Testimonial[]> {
  try {
    const { data, error } = await createSupabaseAdmin()
      .from('landing_testimonials')
      .select('id, name, quote, stars')
      .eq('is_published', true)
      .order('position', { ascending: true })

    if (error || !data || data.length === 0) return [...FALLBACK_TESTIMONIALS]

    return (data as { id: string; name: string; quote: unknown; stars: number }[]).map((r) => ({
      id: r.id,
      name: r.name,
      quote: pickLocalized(r.quote, locale),
      stars: r.stars,
    }))
  } catch {
    return [...FALLBACK_TESTIMONIALS]
  }
}

export async function getFaqItems(locale: Locale): Promise<FaqItem[]> {
  try {
    const { data, error } = await createSupabaseAdmin()
      .from('landing_faq')
      .select('id, question, answer')
      .eq('is_published', true)
      .order('position', { ascending: true })

    if (error || !data || data.length === 0) return [...FALLBACK_FAQ]

    return (data as { id: string; question: unknown; answer: unknown }[]).map((r) => ({
      id: r.id,
      question: pickLocalized(r.question, locale),
      answer: pickLocalized(r.answer, locale),
    }))
  } catch {
    return [...FALLBACK_FAQ]
  }
}
