'use client';

import { useEffect, useState } from 'react';
import { formatSpotsLeft, type CourseOffer } from '@/utils/courses/offer';
import type { LandingCopy } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface StickyProps {
  copy: LandingCopy;
  courseId: string;
  offer: CourseOffer;
}

export default function StickyBuyBar({ courseId, offer, copy }: StickyProps) {
  const [visible, setVisible] = useState(false);
  const spotsText = formatSpotsLeft(copy.offer.spotsLeft, offer.spotsLeft);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`${styles.sticky} ${visible ? styles.stickyVisible : ''}`} inert={!visible}>
      <span className={styles.stickyBrand}>{copy.sticky.brand}</span>
      {/* El precio vivo va en el botón; aquí sólo el tachado y las plazas, para
          no repetir dos veces la misma cifra en una barra tan estrecha. */}
      {(offer.compareAt !== null || spotsText) && (
        <span className={styles.stickyOffer}>
          {offer.compareAt !== null && (
            <s className={styles.stickyCompare}>
              <span className="sr-only">{copy.offer.before}: </span>€{offer.compareAt}
            </s>
          )}
          {spotsText && <span className={styles.stickySpots}>{spotsText}</span>}
        </span>
      )}
      <CourseCtaButton
        courseId={courseId}
        label={offer.price !== null ? `${copy.sticky.cta} · €${offer.price}` : copy.sticky.cta}
        className={styles.stickyCta}
      />
    </div>
  );
}
