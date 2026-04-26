'use client';

import styles from './Newsletter.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { useInView } from '@/hooks/useInView';

export default function Newsletter() {
  const { t } = useLanguage();
  const { ref, inView } = useInView();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`${styles.newsletter} ${inView ? styles.visible : ''}`}
    >
      <div className={styles.container}>
        <h2 className={styles.title}>{t.newsletter.title}</h2>
        <p className={styles.description}>{t.newsletter.desc}</p>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder={t.newsletter.placeholder}
            className={styles.input}
            required
          />
          <button type="submit" className={styles.button}>
            {t.newsletter.button}
          </button>
        </form>
      </div>
    </section>
  );
}
