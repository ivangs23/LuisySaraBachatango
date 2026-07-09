'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';

interface CourseCtaButtonProps {
  courseId: string;
  isAuthed: boolean;
  label: string;
  className?: string;
}

export default function CourseCtaButton({ courseId, isAuthed, label, className }: CourseCtaButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    // Interino (Spec 1): visitante sin cuenta → signup y vuelta a la landing.
    // Spec 2 (guest checkout) sustituirá SOLO esta rama.
    if (!isAuthed) {
      // TODO(Spec 2 – guest checkout): el flujo de signup no propaga ?next=, así que
      // por ahora el visitante frío va a /signup y termina en /dashboard. Guest checkout
      // (pago→cuenta) reemplazará esta rama para volver al pago sin registro previo.
      router.push('/signup');
      return;
    }

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
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`${styles.cta} ${className ?? ''}`}
    >
      {loading ? 'Procesando…' : label}
    </button>
  );
}
