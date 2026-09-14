'use client';

import { sanitizeUrl } from '@/utils/sanitize';
import { formatSpotsLeft, type CourseOffer } from '@/utils/courses/offer';
import OfferPrice from '@/components/OfferPrice';
import type { LandingCopy } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface HeroProps {
  copy: LandingCopy;
  courseId: string;
  isAuthed: boolean;
  offer: CourseOffer;
  imageUrl: string | null;
}

export default function LandingHero({ courseId, isAuthed, offer, imageUrl, copy }: HeroProps) {
  const c = copy.hero;
  const safeBg = imageUrl ? sanitizeUrl(imageUrl) : null;
  const spotsText = formatSpotsLeft(copy.offer.spotsLeft, offer.spotsLeft);
  return (
    <section
      className={styles.hero}
      style={safeBg ? { backgroundImage: `linear-gradient(rgba(5,5,5,0.6), rgba(5,5,5,0.85)), url(${safeBg})` } : undefined}
    >
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>{c.h1}</h1>
        <p className={styles.heroSub}>{c.sub}</p>
        {offer.price !== null && (
          <OfferPrice
            className={styles.heroOffer}
            price={offer.price}
            compareAt={offer.compareAt}
            discountPct={offer.discountPct}
            spotsText={spotsText}
            compareAtLabel={copy.offer.before}
            currency="prefix"
            size="lg"
            align="center"
          />
        )}
        <div className={styles.heroCtaRow}>
          <CourseCtaButton
            courseId={courseId}
            label={offer.price !== null ? `${c.cta} · €${offer.price}` : c.cta}
          />
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
