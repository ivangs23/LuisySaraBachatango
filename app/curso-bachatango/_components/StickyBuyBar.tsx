'use client';

import { useEffect, useState } from 'react';
import { LANDING_COPY } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface StickyProps {
  courseId: string;
  price: number;
}

export default function StickyBuyBar({ courseId, price }: StickyProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`${styles.sticky} ${visible ? styles.stickyVisible : ''}`} inert={!visible}>
      <span className={styles.stickyBrand}>{LANDING_COPY.sticky.brand}</span>
      <CourseCtaButton courseId={courseId} label={`${LANDING_COPY.sticky.cta} · €${price}`} className={styles.stickyCta} />
    </div>
  );
}
