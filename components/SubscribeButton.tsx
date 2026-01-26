'use client';

import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';
import styles from './SubscribeButton.module.css';

export default function SubscribeButton({ priceId }: { priceId?: string }) {
  const [loading, setLoading] = useState(false);

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
    } catch (error: any) {
      console.error(error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleSubscribe} disabled={loading} className={styles.button}>
      {loading ? 'Procesando...' : 'Suscribirse Ahora'}
    </button>
  );
}
