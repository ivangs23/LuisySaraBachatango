'use client'

import { useState, useTransition } from 'react'
import {
  updateStats, upsertTestimonial, deleteTestimonial, upsertFaqItem, deleteFaqItem,
} from '@/app/admin/landing/contenido/actions'
import styles from './LandingContentForms.module.css'

const LOCALES = ['es', 'en', 'fr', 'de', 'it', 'ja'] as const
type Locale = (typeof LOCALES)[number]

const STAT_LABELS: Record<string, string> = {
  years: 'Años bailando',
  students: 'Alumnos',
  countries: 'Países',
  titles: 'Títulos internacionales (solo en «Sobre nosotros»)',
}

type StatRow = { key: string; value: string }
type TestimonialRow = {
  id: string; name: string; quote: Record<string, string>
  stars: number; position: number; is_published: boolean
}
type FaqRow = {
  id: string; question: Record<string, string>; answer: Record<string, string>
  position: number; is_published: boolean
}

type Action = (fd: FormData) => Promise<{ error: string } | void>

/** Formulario que llama a una Server Action y muestra el error devuelto. */
function ActionForm({
  action, children, submitLabel, confirm,
}: {
  action: Action
  children: React.ReactNode
  submitLabel: string
  confirm?: string
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function onSubmit(fd: FormData) {
    if (confirm && !window.confirm(confirm)) return
    setError(null)
    setSaved(false)
    start(async () => {
      const r = await action(fd)
      if (r && 'error' in r) setError(r.error)
      else setSaved(true)
    })
  }

  return (
    <form action={onSubmit} className={styles.form}>
      {children}
      <div className={styles.formFooter}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </button>
        {saved && <span className={styles.saved} role="status">Guardado</span>}
        {error && <span className={styles.error} role="alert">{error}</span>}
      </div>
    </form>
  )
}

/** Campo de texto con una pestaña por idioma. Solo el español es obligatorio. */
function LocalizedField({
  name, label, values, textarea,
}: {
  name: string
  label: string
  values?: Record<string, string>
  textarea?: boolean
}) {
  const [active, setActive] = useState<Locale>('es')

  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={styles.label}>{label}</span>
        <div className={styles.tabs}>
          {LOCALES.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setActive(loc)}
              className={`${styles.tab} ${active === loc ? styles.tabActive : ''}`}
              aria-pressed={active === loc}
            >
              {loc}
              {loc === 'es' && <span aria-hidden="true"> *</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Todos los idiomas van en el DOM a la vez: así el formulario los envía
          aunque la pestaña no esté visible. Se ocultan con CSS, no se
          desmontan. */}
      {LOCALES.map((loc) =>
        textarea ? (
          <textarea
            key={loc}
            name={`${name}_${loc}`}
            defaultValue={values?.[loc] ?? ''}
            rows={3}
            className={styles.input}
            hidden={active !== loc}
            aria-label={`${label} (${loc})`}
          />
        ) : (
          <input
            key={loc}
            type="text"
            name={`${name}_${loc}`}
            defaultValue={values?.[loc] ?? ''}
            className={styles.input}
            hidden={active !== loc}
            aria-label={`${label} (${loc})`}
          />
        ),
      )}
    </div>
  )
}

export default function LandingContentForms({
  stats, testimonials, faq,
}: {
  stats: StatRow[]
  testimonials: TestimonialRow[]
  faq: FaqRow[]
}) {
  const statValue = (k: string) => stats.find((s) => s.key === k)?.value ?? ''

  return (
    <div className={styles.sections}>
      {/* ---------- Cifras ---------- */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Cifras</h2>
        <p className={styles.cardHint}>
          Se ven en el hero, en «Sobre nosotros» y en la imagen de previsualización
          al compartir el enlace. Escribe solo el número: el «+» lo pone la web.
        </p>
        <ActionForm action={updateStats} submitLabel="Guardar cifras">
          <div className={styles.statsGrid}>
            {['years', 'students', 'countries', 'titles'].map((k) => (
              <label key={k} className={styles.field}>
                <span className={styles.label}>{STAT_LABELS[k]}</span>
                <input
                  type="text"
                  name={k}
                  defaultValue={statValue(k)}
                  inputMode="numeric"
                  className={styles.input}
                  required
                />
              </label>
            ))}
          </div>
        </ActionForm>
      </section>

      {/* ---------- Testimonios ---------- */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Testimonios</h2>

        {testimonials.map((t) => (
          <div key={t.id} className={styles.item}>
            <ActionForm action={upsertTestimonial} submitLabel="Guardar">
              <input type="hidden" name="id" value={t.id} />
              <label className={styles.field}>
                <span className={styles.label}>Nombre</span>
                <input type="text" name="name" defaultValue={t.name} className={styles.input} required />
              </label>
              <LocalizedField name="quote" label="Testimonio" values={t.quote} textarea />
              <div className={styles.row}>
                <label className={styles.fieldSmall}>
                  <span className={styles.label}>Estrellas</span>
                  <input type="number" name="stars" min={1} max={5} defaultValue={t.stars} className={styles.input} />
                </label>
                <label className={styles.fieldSmall}>
                  <span className={styles.label}>Orden</span>
                  <input type="number" name="position" defaultValue={t.position} className={styles.input} />
                </label>
                <label className={styles.checkbox}>
                  <input type="checkbox" name="is_published" defaultChecked={t.is_published} />
                  Publicado
                </label>
              </div>
            </ActionForm>
            <ActionForm
              action={deleteTestimonial}
              submitLabel="Borrar"
              confirm={`¿Borrar el testimonio de ${t.name}?`}
            >
              <input type="hidden" name="id" value={t.id} />
            </ActionForm>
          </div>
        ))}

        <details className={styles.item}>
          <summary className={styles.summary}>Añadir testimonio</summary>
          <ActionForm action={upsertTestimonial} submitLabel="Crear">
            <label className={styles.field}>
              <span className={styles.label}>Nombre</span>
              <input type="text" name="name" className={styles.input} required />
            </label>
            <LocalizedField name="quote" label="Testimonio" textarea />
            <div className={styles.row}>
              <label className={styles.fieldSmall}>
                <span className={styles.label}>Estrellas</span>
                <input type="number" name="stars" min={1} max={5} defaultValue={5} className={styles.input} />
              </label>
              <label className={styles.fieldSmall}>
                <span className={styles.label}>Orden</span>
                <input type="number" name="position" defaultValue={testimonials.length + 1} className={styles.input} />
              </label>
              <label className={styles.checkbox}>
                <input type="checkbox" name="is_published" defaultChecked />
                Publicado
              </label>
            </div>
          </ActionForm>
        </details>
      </section>

      {/* ---------- Preguntas frecuentes ---------- */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Preguntas frecuentes</h2>
        <p className={styles.cardHint}>
          Se muestran en la home y alimentan el marcado que lee Google.
        </p>

        {faq.map((f) => (
          <div key={f.id} className={styles.item}>
            <ActionForm action={upsertFaqItem} submitLabel="Guardar">
              <input type="hidden" name="id" value={f.id} />
              <LocalizedField name="question" label="Pregunta" values={f.question} />
              <LocalizedField name="answer" label="Respuesta" values={f.answer} textarea />
              <div className={styles.row}>
                <label className={styles.fieldSmall}>
                  <span className={styles.label}>Orden</span>
                  <input type="number" name="position" defaultValue={f.position} className={styles.input} />
                </label>
                <label className={styles.checkbox}>
                  <input type="checkbox" name="is_published" defaultChecked={f.is_published} />
                  Publicada
                </label>
              </div>
            </ActionForm>
            <ActionForm action={deleteFaqItem} submitLabel="Borrar" confirm="¿Borrar esta pregunta?">
              <input type="hidden" name="id" value={f.id} />
            </ActionForm>
          </div>
        ))}

        <details className={styles.item}>
          <summary className={styles.summary}>Añadir pregunta</summary>
          <ActionForm action={upsertFaqItem} submitLabel="Crear">
            <LocalizedField name="question" label="Pregunta" />
            <LocalizedField name="answer" label="Respuesta" textarea />
            <div className={styles.row}>
              <label className={styles.fieldSmall}>
                <span className={styles.label}>Orden</span>
                <input type="number" name="position" defaultValue={faq.length + 1} className={styles.input} />
              </label>
              <label className={styles.checkbox}>
                <input type="checkbox" name="is_published" defaultChecked />
                Publicada
              </label>
            </div>
          </ActionForm>
        </details>
      </section>
    </div>
  )
}
