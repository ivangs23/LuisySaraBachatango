'use client';

import { LANDING_COPY } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface HeroProps {
  courseId: string;
  isAuthed: boolean;
  price: number;
  imageUrl: string | null;
}

export default function LandingHero({ courseId, isAuthed, price, imageUrl }: HeroProps) {
  const c = LANDING_COPY.hero;
  return (
    <section
      className={styles.hero}
      style={imageUrl ? { backgroundImage: `linear-gradient(rgba(5,5,5,0.6), rgba(5,5,5,0.85)), url(${imageUrl})` } : undefined}
    >
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>{c.h1}</h1>
        <p className={styles.heroSub}>{c.sub}</p>
        <div className={styles.heroCtaRow}>
          <CourseCtaButton courseId={courseId} isAuthed={isAuthed} label={`${c.cta} · €${price}`} />
          <a href="#clase-gratis" className={styles.heroSecondary}>{c.secondary}</a>
        </div>
        <p className={styles.heroMicro}>{c.micro}</p>
      </div>
    </section>
  );
}
