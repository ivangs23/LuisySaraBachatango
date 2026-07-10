'use client';

import { useState } from 'react';
import styles from '../page.module.css';

interface CourseCtaButtonProps {
  courseId: string;
  label: string;
  className?: string;
}

export default function CourseCtaButton({ courseId, label, className }: CourseCtaButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'No se pudo iniciar el pago');
      }
      window.location.assign(data.url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      alert('Error: ' + message);
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={`${styles.cta} ${className ?? ''}`}>
      {loading ? 'Procesando…' : label}
    </button>
  );
}
