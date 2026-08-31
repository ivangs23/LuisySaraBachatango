import type { Locale } from '@/utils/i18n/types'

const LOCALES: Locale[] = ['es', 'en', 'fr', 'de', 'it', 'ja']

/** Conjunto fijo. Lo que venga fuera de aquí se descarta. */
const STAT_KEYS = ['years', 'students', 'countries', 'titles'] as const

function localizedFrom(fd: FormData, prefix: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const loc of LOCALES) {
    out[loc] = String(fd.get(`${prefix}_${loc}`) ?? '').trim()
  }
  return out
}

export function parseStatsForm(
  fd: FormData,
): { payload: { key: string; value: string }[] } | { error: string } {
  const payload: { key: string; value: string }[] = []
  for (const key of STAT_KEYS) {
    const value = String(fd.get(key) ?? '').trim()
    if (value.length === 0) return { error: `La cifra "${key}" no puede estar vacía` }
    payload.push({ key, value })
  }
  return { payload }
}

export function parseTestimonialForm(
  fd: FormData,
): { payload: Record<string, unknown> } | { error: string } {
  const name = String(fd.get('name') ?? '').trim()
  if (name.length === 0) return { error: 'El nombre es obligatorio' }

  const quote = localizedFrom(fd, 'quote')
  if (quote.es.length === 0) return { error: 'El testimonio en español es obligatorio' }

  const stars = Number(fd.get('stars'))
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { error: 'Las estrellas deben ser un número del 1 al 5' }
  }

  const id = String(fd.get('id') ?? '').trim()

  return {
    payload: {
      ...(id ? { id } : {}),
      name,
      quote,
      stars,
      position: Number(fd.get('position')) || 0,
      is_published: fd.get('is_published') === 'on',
    },
  }
}

export function parseFaqForm(
  fd: FormData,
): { payload: Record<string, unknown> } | { error: string } {
  const question = localizedFrom(fd, 'question')
  const answer = localizedFrom(fd, 'answer')

  if (question.es.length === 0) return { error: 'La pregunta en español es obligatoria' }
  if (answer.es.length === 0) return { error: 'La respuesta en español es obligatoria' }

  const id = String(fd.get('id') ?? '').trim()

  return {
    payload: {
      ...(id ? { id } : {}),
      question,
      answer,
      position: Number(fd.get('position')) || 0,
      is_published: fd.get('is_published') === 'on',
    },
  }
}
