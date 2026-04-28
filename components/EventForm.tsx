'use client'

import { useEffect, useMemo, useState } from 'react'
import { createEvent, updateEvent } from '@/app/events/actions'
import styles from './EventForm.module.css'

const LOCALES = ['es', 'en', 'fr', 'de', 'it', 'ja'] as const
type Locale = typeof LOCALES[number]

const LOCALE_LABEL: Record<Locale, string> = {
  es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano', ja: '日本語',
}

type EventInitialData = {
  id: string
  start_date: string
  end_date: string
  location: string
  is_published: boolean
  title: Record<Locale, string>
  description: Record<Locale, string>
}

type Props = { initialData?: EventInitialData }

const emptyLocalized = (): Record<Locale, string> =>
  ({ es: '', en: '', fr: '', de: '', it: '', ja: '' })

export default function EventForm({ initialData }: Props) {
  const [startDate, setStartDate] = useState(initialData?.start_date ?? '')
  const [endDate, setEndDate] = useState(initialData?.end_date ?? '')
  const [location, setLocation] = useState(initialData?.location ?? '')
  const [isPublished, setIsPublished] = useState(initialData?.is_published ?? true)
  const [title, setTitle] = useState<Record<Locale, string>>(initialData?.title ?? emptyLocalized())
  const [description, setDescription] = useState<Record<Locale, string>>(initialData?.description ?? emptyLocalized())
  const [activeLocale, setActiveLocale] = useState<Locale>('es')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-fill end_date if user only sets start_date
  useEffect(() => {
    if (startDate && !endDate) setEndDate(startDate)
  }, [startDate, endDate])

  const isDirty = useMemo(() => {
    if (!initialData) return true
    return (
      startDate !== initialData.start_date ||
      endDate !== initialData.end_date ||
      location !== initialData.location ||
      isPublished !== initialData.is_published ||
      LOCALES.some(loc => title[loc] !== initialData.title[loc]) ||
      LOCALES.some(loc => description[loc] !== initialData.description[loc])
    )
  }, [initialData, startDate, endDate, location, isPublished, title, description])

  const completeness = (loc: Locale): 'complete' | 'empty' =>
    title[loc].trim().length > 0 && description[loc].trim().length > 0 ? 'complete' : 'empty'

  function validate(): string | null {
    if (!startDate) return 'La fecha de inicio es obligatoria'
    if (!endDate) return 'La fecha de fin es obligatoria'
    if (endDate < startDate) return 'La fecha de fin debe ser igual o posterior a la de inicio'
    if (location.trim().length === 0) return 'La ubicación es obligatoria'
    if (title.es.trim().length === 0) return 'El título en español es obligatorio'
    if (description.es.trim().length === 0) return 'La descripción en español es obligatoria'
    return null
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError(null)
    const err = validate()
    if (err) { setValidationError(err); return }
    setValidationError(null)

    if (initialData && !isDirty) return

    const fd = new FormData()
    fd.set('start_date', startDate)
    fd.set('end_date', endDate)
    fd.set('location', location)
    if (isPublished) fd.set('is_published', 'on')
    for (const loc of LOCALES) {
      fd.set(`title_${loc}`, title[loc])
      fd.set(`description_${loc}`, description[loc])
    }

    setIsSubmitting(true)
    try {
      const result = initialData
        ? await updateEvent(initialData.id, fd)
        : await createEvent(fd)
      if (result && 'error' in result) setServerError(result.error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Fecha de inicio</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            required
            aria-label="Fecha de inicio"
          />
        </label>
        <label className={styles.field}>
          <span>Fecha de fin</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            required
            aria-label="Fecha de fin"
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>Ubicación</span>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Madrid, España"
          required
          aria-label="Ubicación"
        />
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={isPublished}
          onChange={e => setIsPublished(e.target.checked)}
        />
        <span>Publicado (visible en /events)</span>
      </label>

      <div className={styles.tabs} role="tablist" aria-label="Idiomas">
        {LOCALES.map(loc => (
          <button
            key={loc}
            type="button"
            role="tab"
            aria-selected={activeLocale === loc}
            aria-label={LOCALE_LABEL[loc]}
            onClick={() => setActiveLocale(loc)}
            className={`${styles.tab} ${activeLocale === loc ? styles.tabActive : ''}`}
          >
            <span
              className={styles.dot}
              data-state={completeness(loc)}
              aria-hidden
            />
            {LOCALE_LABEL[loc]}
          </button>
        ))}
      </div>

      {LOCALES.map(loc => (
        <div
          key={loc}
          role="tabpanel"
          hidden={activeLocale !== loc}
          className={styles.localePanel}
        >
          <label className={styles.field}>
            <span>Título ({LOCALE_LABEL[loc]})</span>
            <input
              type="text"
              value={title[loc]}
              onChange={e => setTitle({ ...title, [loc]: e.target.value })}
              aria-label={`Título ${LOCALE_LABEL[loc]}`}
            />
          </label>
          <label className={styles.field}>
            <span>Descripción ({LOCALE_LABEL[loc]})</span>
            <textarea
              rows={4}
              value={description[loc]}
              onChange={e => setDescription({ ...description, [loc]: e.target.value })}
              aria-label={`Descripción ${LOCALE_LABEL[loc]}`}
            />
          </label>
        </div>
      ))}

      {validationError && <p className={styles.error}>{validationError}</p>}
      {serverError && <p className={styles.error}>{serverError}</p>}

      <div className={styles.actions}>
        <button
          type="submit"
          disabled={isSubmitting || (initialData && !isDirty)}
          className={styles.submit}
        >
          {isSubmitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
