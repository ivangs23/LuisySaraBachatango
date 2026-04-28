'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import styles from './LessonNavigation.module.css';

type NavTarget = {
  id: string;
  title: string;
  displayNumber: string;
};

type Props = {
  courseId: string;
  prev: NavTarget | null;
  next: NavTarget | null;
};

export default function LessonNavigation({ courseId, prev, next }: Props) {
  const { t } = useLanguage();

  if (!prev && !next) return null;

  return (
    <nav className={styles.bar} aria-label={t.lesson.lessonNavigation}>
      {prev && (
        <Link
          href={`/courses/${courseId}/${prev.id}`}
          className={styles.button}
          aria-label={`${t.lesson.previousLesson}: ${prev.displayNumber} ${prev.title}`}
        >
          <ChevronLeft size={20} strokeWidth={2.2} className={styles.icon} aria-hidden="true" />
          <span className={styles.label}>
            <span className={styles.eyebrow}>{t.lesson.previousLesson}</span>
            <span className={styles.titleRow}>
              <span className={styles.number}>{prev.displayNumber}</span>
              <span className={styles.title}>{prev.title}</span>
            </span>
          </span>
        </Link>
      )}

      {next && (
        <Link
          href={`/courses/${courseId}/${next.id}`}
          className={`${styles.button} ${styles.next}`}
          aria-label={`${t.lesson.nextLesson}: ${next.displayNumber} ${next.title}`}
        >
          <span className={styles.label}>
            <span className={styles.eyebrow}>{t.lesson.nextLesson}</span>
            <span className={styles.titleRow}>
              <span className={styles.number}>{next.displayNumber}</span>
              <span className={styles.title}>{next.title}</span>
            </span>
          </span>
          <ChevronRight size={20} strokeWidth={2.2} className={styles.icon} aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
