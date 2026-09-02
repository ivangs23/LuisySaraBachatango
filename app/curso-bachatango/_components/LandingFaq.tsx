'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LandingCopy } from '../copy';
import styles from '../page.module.css';

export default function LandingFaq({ copy }: { copy: LandingCopy }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={styles.faq}>
      {copy.faq.map((item, i) => {
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
