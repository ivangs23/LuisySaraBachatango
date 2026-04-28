'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MapPin, CalendarOff, Plus, Pencil, Trash2 } from 'lucide-react'
import Reveal from '@/components/Reveal'
import styles from '@/app/events/page.module.css'
import { useLanguage } from '@/context/LanguageContext'
import { deleteEvent } from '@/app/events/actions'
import type { Locale } from '@/utils/dictionaries'

export type EventRow = {
  id: string
  start_date: string
  end_date: string
  location: string
  is_published: boolean
  title: Record<string, string>
  description: Record<string, string>
}

type Props = {
  events: EventRow[]
  isAdmin: boolean
}

type Presentation = {
  startDay: number
  endDay: number
  monthLabel: string
  year: number
  endOfDayMs: number
}

function derive(start: string, end: string, locale: Locale): Presentation {
  const s = new Date(`${start}T00:00:00Z`)
  const e = new Date(`${end}T23:59:59Z`)
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
    .format(s)
    .replace('.', '')
    .toUpperCase()
  return {
    startDay: s.getUTCDate(),
    endDay: e.getUTCDate(),
    monthLabel,
    year: s.getUTCFullYear(),
    endOfDayMs: e.getTime(),
  }
}

function pickLocalized(map: Record<string, string>, locale: Locale): string {
  return (map[locale] && map[locale].length > 0) ? map[locale] : (map.es ?? '')
}

export default function EventsClient({ events, isAdmin }: Props) {
  const { t, locale } = useLanguage()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const enriched = useMemo(
    () => events.map(ev => ({ ...ev, presentation: derive(ev.start_date, ev.end_date, locale) })),
    [events, locale],
  )

  const now = Date.now()
  const upcoming = enriched.filter(ev => ev.presentation.endOfDayMs >= now)
  const past = enriched.filter(ev => ev.presentation.endOfDayMs < now)

  async function handleDelete(id: string) {
    if (!window.confirm(t.events.deleteConfirm)) return
    setPendingDelete(id)
    try {
      await deleteEvent(id)
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className={styles.container}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroCornerTL} aria-hidden="true" />
        <span className={styles.heroCornerTR} aria-hidden="true" />

        <div className={styles.heroInner}>
          <Reveal>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              EN VIVO · TOUR 2026
              <span className={styles.eyebrowLine} aria-hidden="true" />
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className={styles.title}>
              {t.events.title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className={styles.titleAccent}>
                {t.events.title.split(' ').slice(-1)[0] ?? ''}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className={styles.subtitle}>{t.events.desc}</p>
          </Reveal>

          <Reveal delay={0.18}>
            <span className={styles.heroMeta}>
              <span className={styles.heroMetaDot} aria-hidden="true" />
              {upcoming.length} {upcoming.length === 1 ? t.events.upcoming.singular : t.events.upcoming.plural}
            </span>
          </Reveal>

          {isAdmin && (
            <Reveal delay={0.22}>
              <Link href="/events/create" className={styles.createBtn}>
                <Plus size={14} aria-hidden /> {t.events.create}
              </Link>
            </Reveal>
          )}
        </div>
      </section>

      {/* UPCOMING */}
      <section className={styles.timeline}>
        <Reveal>
          <div className={styles.timelineHeader}>
            <div className={styles.timelineTitleBlock}>
              <span className={styles.timelineEyebrow}>
                <span className={styles.timelineEyebrowLine} aria-hidden="true" />
                {t.events.upcoming.eyebrow}
              </span>
              <h2 className={styles.timelineTitle}>
                {t.events.upcoming.heading}
                {upcoming.length > 0 && (
                  <span className={styles.timelineCount}>
                    ({String(upcoming.length).padStart(2, '0')})
                  </span>
                )}
              </h2>
            </div>
          </div>
        </Reveal>

        {upcoming.length > 0 ? (
          <div className={styles.grid}>
            {upcoming.map((event, i) => (
              <Reveal key={event.id} delay={Math.min(i * 0.05, 0.4)} direction="up" distance={20}>
                <article className={`${styles.eventCard} ${!event.is_published ? styles.eventCardDraft : ''}`}>
                  {isAdmin && (
                    <div className={styles.adminActions}>
                      <Link href={`/events/${event.id}/edit`} className={styles.adminBtn} aria-label={t.events.edit}>
                        <Pencil size={12} aria-hidden />
                      </Link>
                      <button
                        type="button"
                        className={styles.adminBtn}
                        onClick={() => handleDelete(event.id)}
                        disabled={pendingDelete === event.id}
                        aria-label={t.events.delete}
                      >
                        <Trash2 size={12} aria-hidden />
                      </button>
                    </div>
                  )}
                  {!event.is_published && isAdmin && (
                    <span className={styles.draftBadge}>{t.events.draft}</span>
                  )}

                  <div className={styles.dateBadge}>
                    <span className={styles.dateMonth}>{event.presentation.monthLabel}</span>
                    <span className={styles.dateDay}>
                      {String(event.presentation.startDay).padStart(2, '0')}
                    </span>
                    <span className={styles.dateYear}>{event.presentation.year}</span>
                    {event.presentation.endDay !== event.presentation.startDay && (
                      <span className={styles.dateRange}>
                        → {String(event.presentation.endDay).padStart(2, '0')}
                      </span>
                    )}
                  </div>

                  <div className={styles.cardContent}>
                    <span className={styles.eventLocation}>
                      <MapPin size={11} strokeWidth={2.4} aria-hidden="true" />
                      {event.location}
                    </span>
                    <h3 className={styles.eventTitle}>{pickLocalized(event.title, locale)}</h3>
                    <p className={styles.eventDescription}>{pickLocalized(event.description, locale)}</p>

                    <div className={styles.cardFooter}>
                      <span className={`${styles.statusPill} ${styles.statusUpcoming}`}>
                        {t.events.upcoming.pill}
                      </span>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <div className={styles.empty}>
              <div className={styles.emptyHalo} aria-hidden="true" />
              <span className={styles.emptyIcon} aria-hidden="true">
                <CalendarOff size={20} strokeWidth={1.8} />
              </span>
              <h3 className={styles.emptyTitle}>{t.events.empty.title}</h3>
              <p className={styles.emptyText}>{t.events.empty.text}</p>
            </div>
          </Reveal>
        )}
      </section>

      {/* PAST */}
      {past.length > 0 && (
        <section className={styles.timeline} style={{ marginTop: '2.5rem' }}>
          <Reveal>
            <div className={styles.timelineHeader}>
              <div className={styles.timelineTitleBlock}>
                <span className={styles.timelineEyebrow}>
                  <span className={styles.timelineEyebrowLine} aria-hidden="true" />
                  {t.events.past.eyebrow}
                </span>
                <h2 className={styles.timelineTitle}>
                  {t.events.past.heading}
                  <span className={styles.timelineCount}>
                    ({String(past.length).padStart(2, '0')})
                  </span>
                </h2>
              </div>
            </div>
          </Reveal>

          <div className={styles.grid}>
            {past.map((event, i) => (
              <Reveal key={event.id} delay={Math.min(i * 0.05, 0.3)} direction="up" distance={20}>
                <article className={`${styles.eventCard} ${styles.eventCardPast}`}>
                  {isAdmin && (
                    <div className={styles.adminActions}>
                      <Link href={`/events/${event.id}/edit`} className={styles.adminBtn} aria-label={t.events.edit}>
                        <Pencil size={12} aria-hidden />
                      </Link>
                      <button
                        type="button"
                        className={styles.adminBtn}
                        onClick={() => handleDelete(event.id)}
                        disabled={pendingDelete === event.id}
                        aria-label={t.events.delete}
                      >
                        <Trash2 size={12} aria-hidden />
                      </button>
                    </div>
                  )}
                  <div className={styles.dateBadge}>
                    <span className={styles.dateMonth}>{event.presentation.monthLabel}</span>
                    <span className={styles.dateDay}>
                      {String(event.presentation.startDay).padStart(2, '0')}
                    </span>
                    <span className={styles.dateYear}>{event.presentation.year}</span>
                  </div>

                  <div className={styles.cardContent}>
                    <span className={styles.eventLocation}>
                      <MapPin size={11} strokeWidth={2.4} aria-hidden="true" />
                      {event.location}
                    </span>
                    <h3 className={styles.eventTitle}>{pickLocalized(event.title, locale)}</h3>
                    <p className={styles.eventDescription}>{pickLocalized(event.description, locale)}</p>

                    <div className={styles.cardFooter}>
                      <span className={`${styles.statusPill} ${styles.statusPast}`}>
                        <CalendarDays size={10} strokeWidth={2.4} aria-hidden="true" />
                        {t.events.past.pill}
                      </span>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
