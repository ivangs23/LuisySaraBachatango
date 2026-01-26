'use client';

import styles from './Newsletter.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function Newsletter() {
  const { t } = useLanguage();
  
  return (
    <section className={styles.newsletter}>
      <div className={styles.container}>
        <h2 className={styles.title}>{t.newsletter.title}</h2>
        <p className={styles.description}>
          {t.newsletter.desc}
        </p>
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
