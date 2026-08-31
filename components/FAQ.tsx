'use client';

import { useState } from 'react';
import styles from './FAQ.module.css';
import { useLanguage } from '@/context/LanguageContext';
import type { FaqItem } from '@/utils/landing/content';

export default function FAQ({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { t } = useLanguage();

  // Sin preguntas no se pinta la sección.
  if (items.length === 0) return null;

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className={styles.faq}>
      <div className={styles.container}>
        <h2 className={styles.title}>{t.faq.title}</h2>
        <div className={styles.list}>
          {items.map((faq, index) => (
            <div key={faq.id} className={styles.item}>
              <button
                id={`faq-question-${index}`}
                className={styles.question}
                onClick={() => toggle(index)}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                {faq.question}
                <span className={`${styles.icon} ${openIndex === index ? styles.open : ''}`}>+</span>
              </button>
              <div
                id={`faq-answer-${index}`}
                className={`${styles.answer} ${openIndex === index ? styles.open : ''}`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
              >
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
