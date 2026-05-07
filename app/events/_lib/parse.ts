export type EventLocale = 'es' | 'en' | 'fr' | 'de' | 'it' | 'ja'
const LOCALES: EventLocale[] = ['es', 'en', 'fr', 'de', 'it', 'ja']

export type EventPayload = {
  start_date: string
  end_date: string
  location: string
  is_published: boolean
  title: Record<EventLocale, string>
  description: Record<EventLocale, string>
}

export type ParseResult =
  | { payload: EventPayload }
  | { error: string }

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === value
}

export function parseEventForm(formData: FormData): ParseResult {
  const start_date = String(formData.get('start_date') ?? '').trim()
  const end_date = String(formData.get('end_date') ?? '').trim()
  const location = String(formData.get('location') ?? '').trim()
  const is_published = formData.get('is_published') === 'on'

  if (!isValidIsoDate(start_date)) return { error: 'Fecha de inicio inválida' }
  if (!isValidIsoDate(end_date)) return { error: 'Fecha de fin inválida' }
  if (end_date < start_date) return { error: 'La fecha de fin debe ser igual o posterior a la de inicio' }
  if (location.length === 0) return { error: 'La ubicación es obligatoria' }

  const title = {} as Record<EventLocale, string>
  const description = {} as Record<EventLocale, string>
  for (const loc of LOCALES) {
    title[loc] = String(formData.get(`title_${loc}`) ?? '').trim()
    description[loc] = String(formData.get(`description_${loc}`) ?? '').trim()
  }

  if (title.es.length === 0) return { error: 'El título en español es obligatorio' }
  if (description.es.length === 0) return { error: 'La descripción en español es obligatoria' }

  if (location.length > 200) return { error: 'location_too_long' }
  for (const loc of LOCALES) {
    if (title[loc].length > 500) return { error: 'title_too_long' }
    if (description[loc].length > 5000) return { error: 'description_too_long' }
  }

  return {
    payload: { start_date, end_date, location, is_published, title, description },
  }
}
