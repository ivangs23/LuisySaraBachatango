'use client';

import { useEffect, useState } from 'react';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface StickyProps {
  courseId: string;
  isAuthed: boolean;
  price: number;
}

export default function StickyBuyBar({ courseId, isAuthed, price }: StickyProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`${styles.sticky} ${visible ? styles.stickyVisible : ''}`} aria-hidden={!visible}>
      <span className={styles.stickyBrand}>Luis y Sara · CURSO BACHATANGO</span>
      <CourseCtaButton courseId={courseId} isAuthed={isAuthed} label={`Comprar · €${price}`} className={styles.stickyCta} />
    </div>
  );
}
