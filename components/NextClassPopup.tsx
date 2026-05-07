'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './NextClassPopup.module.css';

type Lesson = {
  id: string;
  title: string;
  release_date: string;
  course_id: string;
};

export default function NextClassPopup() {
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    async function fetchNextLesson() {
      try {
        const res = await fetch('/api/lessons/next');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setNextLesson(data);
            setIsVisible(true);
          }
        }
      } catch (error) {
        console.error('Failed to fetch next lesson', error);
      }
    }

    fetchNextLesson();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    previousFocusRef.current = document.activeElement as HTMLElement;

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, a[href], [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsVisible(false);
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus();
    };
  }, [isVisible]);

  if (!isVisible || !nextLesson) return null;

  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-labelledby="next-class-popup-title"
      >
        <button onClick={() => setIsVisible(false)} className={styles.closeButton} aria-label="Cerrar">×</button>

        <h2 id="next-class-popup-title" className={styles.title}>¡Nueva Clase Disponible!</h2>
        
        <div className={styles.thumbnailContainer}>
          {/* Placeholder image - in real app use lesson thumbnail */}
          <div className={styles.thumbnail} style={{backgroundColor: '#333'}} />
          <div className={styles.playOverlay}>
            <div className={styles.playIcon}>▶</div>
          </div>
        </div>

        <p className={styles.message}>
          La clase de la <strong>{nextLesson.title}</strong> ya está desbloqueada para ti.
        </p>

        <Link href={`/courses/${nextLesson.course_id}/${nextLesson.id}`} className={styles.ctaButton}>
          VER CLASE AHORA
        </Link>
      </div>
    </div>
  );
}
