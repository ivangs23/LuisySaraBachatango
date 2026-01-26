'use client';

import styles from './Testimonials.module.css';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';

export default function Testimonials() {
  const { t } = useLanguage();

  const TESTIMONIALS = [
    {
      id: 1,
      name: "Elena M.",
      role: t.testimonials.t1.role,
      image: "/avatar-placeholder.png", 
      quote: t.testimonials.t1.quote,
      stars: 5,
    },
    {
      id: 2,
      name: "Carlos R.",
      role: t.testimonials.t2.role,
      image: "/avatar-placeholder.png",
      quote: t.testimonials.t2.quote,
      stars: 5,
    },
    {
      id: 3,
      name: "Sofía y Marc",
      role: t.testimonials.t3.role,
      image: "/avatar-placeholder.png",
      quote: t.testimonials.t3.quote,
      stars: 5,
    }
  ];

  return (
    <section className={styles.testimonials}>
      <h2 className={styles.title}>{t.testimonials.title}</h2>
      <div className={styles.grid}>
        {TESTIMONIALS.map((t) => (
          <div key={t.id} className={styles.card}>
            <div className={styles.stars}>{"★".repeat(t.stars)}</div>
            <p className={styles.quote}>"{t.quote}"</p>
            <p className={styles.author}>{t.name}</p>
             {/* <span className={styles.role}>{t.role}</span> */}
          </div>
        ))}
      </div>
    </section>
  );
}
