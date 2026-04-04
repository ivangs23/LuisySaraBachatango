'use client';

import { useState } from 'react';
import styles from './SubscribeButton.module.css';

interface BuyCourseButtonProps {
  courseId: string;
  /** Optional override price ID. If omitted the API uses the course's stripe_price_id. */
  priceId?: string;
  label?: string;
}

export default function BuyCourseButton({ courseId, priceId, label = 'Comprar curso' }: BuyCourseButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, priceId }),
      });

      const data = await response.json() as { url?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Error al crear la sesión de pago');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No se recibió URL de pago');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error(error);
      alert('Error: ' + message);
      setLoading(false);
    }
  };

  return (
    <button onClick={handleBuy} disabled={loading} className={styles.button}>
      {loading ? 'Procesando...' : label}
    </button>
  );
}
