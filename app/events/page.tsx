'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, ArrowUpRight, CalendarOff } from 'lucide-react';
import Reveal from '@/components/Reveal';
import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

type RawEvent = {
  id: number;
  date: string;
  location: string;
  title: string;
  description: string;
  link: string;
};

type ParsedDate = {
  startDay: number | null;
  endDay: number | null;
  monthLabel: string | null;
  year: number | null;
  endDate: Date | null;
};

const MONTH_LOOKUP: Record<string, number> = {
  // ES
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
  // EN
  JAN: 1, APR: 4, AUG: 8, DEC: 12,
  // FR / IT extras
  FEV: 2, AVR: 4, MAI: 5, AOU: 8, GEN: 1, MAG: 5, GIU: 6, LUG: 7, SET: 9, OTT: 10,
  // DE extras
  MÄR: 3, OKT: 10, DEZ: 12,
};

function parseEventDate(raw: string): ParsedDate {
  if (!raw) return { startDay: null, endDay: null, monthLabel: null, year: null, endDate: null };

  // Match either "DD - DD MMM YYYY" or "DD MMM YYYY"
  const rangeMatch = raw.match(/^\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([\p{L}]{3,4})\s+(\d{4})/u);
  const singleMatch = raw.match(/^\s*(\d{1,2})\s+([\p{L}]{3,4})\s+(\d{4})/u);

  let startDay: number | null = null;
  let endDay: number | null = null;
  let monthLabel: string | null = null;
  let year: number | null = null;

  if (rangeMatch) {
    startDay = parseInt(rangeMatch[1], 10);
    endDay = parseInt(rangeMatch[2], 10);
    monthLabel = rangeMatch[3].toUpperCase();
    year = parseInt(rangeMatch[4], 10);
  } else if (singleMatch) {
    startDay = parseInt(singleMatch[1], 10);
    endDay = startDay;
    monthLabel = singleMatch[2].toUpperCase();
    year = parseInt(singleMatch[3], 10);
  }

  let endDate: Date | null = null;
  if (year && monthLabel && endDay) {
    const monthNum = MONTH_LOOKUP[monthLabel];
    if (monthNum) {
      // End-of-day so an event on its last day is still "upcoming"
      endDate = new Date(Date.UTC(year, monthNum - 1, endDay, 23, 59, 59));
    }
  }

  return { startDay, endDay, monthLabel, year, endDate };
}

export default function EventsPage() {
  const { t } = useLanguage();

  const items = t.events.items as Record<string, { t: string; d: string; l: string; date: string }>;

  const events: RawEvent[] = useMemo(
    () =>
      Object.values(items).map((ev, i) => ({
        id: i + 1,
        date: ev.date,
        location: ev.l,
        title: ev.t,
        description: ev.d,
        link: '#',
      })),
    [items],
  );

  const enriched = events.map(ev => ({ ...ev, parsed: parseEventDate(ev.date) }));

  const now = new Date();
  const upcoming = enriched.filter(
    ev => !ev.parsed.endDate || ev.parsed.endDate.getTime() >= now.getTime(),
  );
  const past = enriched.filter(
    ev => ev.parsed.endDate && ev.parsed.endDate.getTime() < now.getTime(),
  );

  return (
    <div className={styles.container}>
      {/* ===== Hero ===== */}
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
              {upcoming.length} {upcoming.length === 1 ? 'PRÓXIMA FECHA' : 'PRÓXIMAS FECHAS'}
            </span>
          </Reveal>
        </div>
      </section>

      {/* ===== Upcoming ===== */}
      <section className={styles.timeline}>
        <Reveal>
          <div className={styles.timelineHeader}>
            <div className={styles.timelineTitleBlock}>
              <span className={styles.timelineEyebrow}>
                <span className={styles.timelineEyebrowLine} aria-hidden="true" />
                AGENDA
              </span>
              <h2 className={styles.timelineTitle}>
                Próximas paradas
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
              <Reveal
                key={event.id}
                delay={Math.min(i * 0.05, 0.4)}
                direction="up"
                distance={20}
              >
                <article className={styles.eventCard}>
                  <div className={styles.dateBadge}>
                    {event.parsed.monthLabel ? (
                      <>
                        <span className={styles.dateMonth}>
                          {event.parsed.monthLabel}
                        </span>
                        <span className={styles.dateDay}>
                          {event.parsed.startDay
                            ? String(event.parsed.startDay).padStart(2, '0')
                            : '—'}
                        </span>
                        <span className={styles.dateYear}>
                          {event.parsed.year ?? ''}
                        </span>
                        {event.parsed.endDay &&
                          event.parsed.startDay &&
                          event.parsed.endDay !== event.parsed.startDay && (
                            <span className={styles.dateRange}>
                              → {String(event.parsed.endDay).padStart(2, '0')}
                            </span>
                          )}
                      </>
                    ) : (
                      <span className={styles.dateDay}>{event.date}</span>
                    )}
                  </div>

                  <div className={styles.cardContent}>
                    <span className={styles.eventLocation}>
                      <MapPin size={11} strokeWidth={2.4} aria-hidden="true" />
                      {event.location}
                    </span>
                    <h3 className={styles.eventTitle}>{event.title}</h3>
                    <p className={styles.eventDescription}>{event.description}</p>

                    <div className={styles.cardFooter}>
                      <span className={`${styles.statusPill} ${styles.statusUpcoming}`}>
                        Próxima
                      </span>
                      <Link href={event.link} className={styles.ctaButton}>
                        {t.events.details}
                        <ArrowUpRight size={12} strokeWidth={2.6} aria-hidden="true" />
                      </Link>
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
              <h3 className={styles.emptyTitle}>Estamos preparando nuevas fechas</h3>
              <p className={styles.emptyText}>
                Vuelve pronto o síguenos en redes para enterarte de la próxima parada.
              </p>
            </div>
          </Reveal>
        )}
      </section>

      {/* ===== Past ===== */}
      {past.length > 0 && (
        <section className={styles.timeline} style={{ marginTop: '2.5rem' }}>
          <Reveal>
            <div className={styles.timelineHeader}>
              <div className={styles.timelineTitleBlock}>
                <span className={styles.timelineEyebrow}>
                  <span className={styles.timelineEyebrowLine} aria-hidden="true" />
                  ARCHIVO
                </span>
                <h2 className={styles.timelineTitle}>
                  Fechas pasadas
                  <span className={styles.timelineCount}>
                    ({String(past.length).padStart(2, '0')})
                  </span>
                </h2>
              </div>
            </div>
          </Reveal>

          <div className={styles.grid}>
            {past.map((event, i) => (
              <Reveal
                key={event.id}
                delay={Math.min(i * 0.05, 0.3)}
                direction="up"
                distance={20}
              >
                <article className={`${styles.eventCard} ${styles.eventCardPast}`}>
                  <div className={styles.dateBadge}>
                    {event.parsed.monthLabel ? (
                      <>
                        <span className={styles.dateMonth}>
                          {event.parsed.monthLabel}
                        </span>
                        <span className={styles.dateDay}>
                          {event.parsed.startDay
                            ? String(event.parsed.startDay).padStart(2, '0')
                            : '—'}
                        </span>
                        <span className={styles.dateYear}>
                          {event.parsed.year ?? ''}
                        </span>
                      </>
                    ) : (
                      <span className={styles.dateDay}>{event.date}</span>
                    )}
                  </div>

                  <div className={styles.cardContent}>
                    <span className={styles.eventLocation}>
                      <MapPin size={11} strokeWidth={2.4} aria-hidden="true" />
                      {event.location}
                    </span>
                    <h3 className={styles.eventTitle}>{event.title}</h3>
                    <p className={styles.eventDescription}>{event.description}</p>

                    <div className={styles.cardFooter}>
                      <span className={`${styles.statusPill} ${styles.statusPast}`}>
                        <CalendarDays size={10} strokeWidth={2.4} aria-hidden="true" />
                        Pasado
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
  );
}
