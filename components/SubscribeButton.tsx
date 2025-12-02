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

      const { sessionId } = await response.json();
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      
      if (stripe) {
        const { error } = await (stripe as any).redirectToCheckout({ sessionId });
        if (error) {
          console.error(error);
        }
      }
    } catch (error) {
      console.error(error);
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
