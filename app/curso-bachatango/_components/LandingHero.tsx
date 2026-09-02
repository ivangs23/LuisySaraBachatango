'use client';

import { sanitizeUrl } from '@/utils/sanitize';
import type { LandingCopy } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface HeroProps {
  copy: LandingCopy;
  courseId: string;
  isAuthed: boolean;
  price: number;
  imageUrl: string | null;
}

export default function LandingHero({ courseId, isAuthed, price, imageUrl, copy }: HeroProps) {
  const c = copy.hero;
  const safeBg = imageUrl ? sanitizeUrl(imageUrl) : null;
  return (
    <section
      className={styles.hero}
      style={safeBg ? { backgroundImage: `linear-gradient(rgba(5,5,5,0.6), rgba(5,5,5,0.85)), url(${safeBg})` } : undefined}
    >
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>{c.h1}</h1>
        <p className={styles.heroSub}>{c.sub}</p>
        <div className={styles.heroCtaRow}>
          <CourseCtaButton courseId={courseId} label={`${c.cta} · €${price}`} />
          <a href="#clase-gratis" className={styles.heroSecondary}>{c.secondary}</a>
        </div>
        <p className={styles.heroMicro}>{c.micro}</p>
        {!isAuthed && (
          <p className={styles.heroLogin}>
            {c.haveAccount} <a href="/login">{c.login}</a>
          </p>
        )}
      </div>
    </section>
  );
}
