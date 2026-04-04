'use client';

import { useState } from 'react';
import styles from './SubscribeButton.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function SubscribeButton({ priceId }: { priceId?: string }) {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = data;
      
      if (url) {
        window.open(url, '_blank');
        setLoading(false); // Reset loading since we stay on page
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      console.error(error);
      alert('Error: ' + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleSubscribe} disabled={loading} className={styles.button}>
      {loading ? t.common.processing : t.common.subscribeNow}
    </button>
  );
}
