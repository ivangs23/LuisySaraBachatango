'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from '../page.module.css';

/**
 * Recibe las preguntas ya resueltas en servidor (con las cifras del temario
 * dentro), no el copy entero: al cliente solo viaja lo que se pinta.
 */
export default function LandingFaq({ items }: { items: readonly { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={styles.faq}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={styles.faqItem}>
            <button
              type="button"
              className={styles.faqQ}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span>{item.q}</span>
              <ChevronDown size={18} className={isOpen ? styles.faqIconOpen : undefined} aria-hidden="true" />
            </button>
            {isOpen && <p className={styles.faqA}>{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
