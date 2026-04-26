'use client';

import styles from './Testimonials.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { useInView } from '@/hooks/useInView';

export default function Testimonials() {
  const { t } = useLanguage();
  const { ref, inView } = useInView();

  const TESTIMONIALS = [
    { id: 1, name: "Elena M.",     quote: t.testimonials.t1.quote, stars: 5 },
    { id: 2, name: "Carlos R.",    quote: t.testimonials.t2.quote, stars: 5 },
    { id: 3, name: "Sofía y Marc", quote: t.testimonials.t3.quote, stars: 5 },
  ];

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`${styles.testimonials} ${inView ? styles.visible : ''}`}
    >
      <div className={styles.titleWrapper}>
        <h2 className={styles.title}>{t.testimonials.title}</h2>
        <div className={styles.titleLine} aria-hidden="true" />
      </div>

      <div className={styles.grid}>
        {TESTIMONIALS.map((item, idx) => (
          <div
            key={item.id}
            className={`${styles.card} ${inView ? styles.cardRevealed : ''}`}
            style={{ '--delay': `${idx * 0.15 + 0.2}s` } as React.CSSProperties}
          >
            <span className={styles.quoteMark} aria-hidden="true">"</span>
            <div className={styles.stars}>{'★'.repeat(item.stars)}</div>
            <p className={styles.quote}>"{item.quote}"</p>
            <p className={styles.author}>{item.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
