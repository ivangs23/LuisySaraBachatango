'use client';

import { useEffect, useState } from 'react';
import type { LandingCopy } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface StickyProps {
  copy: LandingCopy;
  courseId: string;
  price: number;
}

export default function StickyBuyBar({ courseId, price, copy }: StickyProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`${styles.sticky} ${visible ? styles.stickyVisible : ''}`} inert={!visible}>
      <span className={styles.stickyBrand}>{copy.sticky.brand}</span>
      <CourseCtaButton courseId={courseId} label={`${copy.sticky.cta} · €${price}`} className={styles.stickyCta} />
    </div>
  );
}
