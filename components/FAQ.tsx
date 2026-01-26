'use client';

import { useState } from 'react';
import styles from './FAQ.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { t } = useLanguage();

  const FAQS = [
    {
      question: t.faq.q1.q,
      answer: t.faq.q1.a
    },
    {
      question: t.faq.q2.q,
      answer: t.faq.q2.a
    },
    {
      question: t.faq.q3.q,
      answer: t.faq.q3.a
    },
    {
      question: t.faq.q4.q,
      answer: t.faq.q4.a
    }
  ];

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className={styles.faq}>
      <div className={styles.container}>
        <h2 className={styles.title}>{t.faq.title}</h2>
        <div className={styles.list}>
          {FAQS.map((faq, index) => (
            <div key={index} className={styles.item}>
              <button 
                className={styles.question} 
                onClick={() => toggle(index)}
                aria-expanded={openIndex === index}
              >
                {faq.question}
                <span className={`${styles.icon} ${openIndex === index ? styles.open : ''}`}>+</span>
              </button>
              <div className={`${styles.answer} ${openIndex === index ? styles.open : ''}`}>
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
