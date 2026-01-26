'use client';

import Link from 'next/link';
import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function EventsPage() {
  const { t } = useLanguage();

  const EVENTS = [
    {
      id: 1,
      date: t.events.items.e1.date,
      location: t.events.items.e1.l,
      title: t.events.items.e1.t,
      description: t.events.items.e1.d,
      link: "#"
    },
    {
      id: 2,
      date: t.events.items.e2.date,
      location: t.events.items.e2.l,
      title: t.events.items.e2.t,
      description: t.events.items.e2.d,
      link: "#"
    },
    {
      id: 3,
      date: t.events.items.e3.date,
      location: t.events.items.e3.l,
      title: t.events.items.e3.t,
      description: t.events.items.e3.d,
      link: "#"
    },
    {
      id: 4,
      date: t.events.items.e4.date,
      location: t.events.items.e4.l,
      title: t.events.items.e4.t,
      description: t.events.items.e4.d,
      link: "#"
    }
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t.events.title}</h1>
      <p className={styles.subtitle}>
        {t.events.desc}
      </p>

      <div className={styles.grid}>
        {EVENTS.map(event => (
          <div key={event.id} className={styles.eventCard}>
            <div className={styles.dateBadge}>{event.date}</div>
            <div className={styles.cardContent}>
              <span className={styles.eventLocation}>{event.location}</span>
              <h2 className={styles.eventTitle}>{event.title}</h2>
              <p className={styles.eventDescription}>{event.description}</p>
              <Link href={event.link} className={styles.ctaButton}>
                {t.events.details}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
