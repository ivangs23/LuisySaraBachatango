import 'server-only'
import { unstable_cache } from 'next/cache'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import type { Locale } from '@/utils/i18n/types'
import { pickLocalized } from './locale-text'
import { FALLBACK_STATS, FALLBACK_FAQ } from './fallbacks'

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

type TestimonialRow = { id: string; name: string; quote: unknown; stars: number }

// Se cachean las filas sin localizar: una sola entrada sirve a los seis
// idiomas. El error se propaga para que `unstable_cache` no lo guarde.
async function leerTestimonios(): Promise<TestimonialRow[]> {
  const { data, error } = await createSupabaseAdmin()
    .from('landing_testimonials')
    .select('id, name, quote, stars')
    .eq('is_published', true)
    .order('position', { ascending: true })

  if (error) throw new Error(`[landing-testimonials] ${error.message ?? 'consulta fallida'}`)
  return (data ?? []) as TestimonialRow[]
}

const testimoniosCacheados = unstable_cache(leerTestimonios, ['landing-testimonials'], {
  revalidate: 300,
  tags: ['landing-testimonials'],
})

/**
 * Testimonios publicados, en el idioma pedido. Los pintan la home y la
 * landing de anuncios, así que las dos enseñan siempre los mismos.
 *
 * Cacheado como el curso y el temario: la landing no hace ninguna consulta
 * por visita y esta no debe ser la primera. Publicar o borrar uno desde el
 * admin invalida la etiqueta (app/admin/landing/contenido/actions.ts).
 *
 * Sin filas publicadas, o con la BD caída, devuelve `[]` y la sección no se
 * pinta. No hay testimonios de reserva en el código: un error de BD nunca
 * debe enseñar citas que no ha escrito un alumno.
 */
export async function getTestimonials(locale: Locale): Promise<Testimonial[]> {
  try {
    const rows = await testimoniosCacheados()
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      quote: pickLocalized(r.quote, locale),
      stars: r.stars,
    }))
  } catch (e) {
    console.error('[landing-testimonials] lectura fallida: %s', (e as Error).message)
    return []
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
