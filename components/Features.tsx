'use client';

import styles from './Features.module.css';
import { useLanguage } from '@/context/LanguageContext';

export default function Features() {
  const { t } = useLanguage();

  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <div className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
          </div>
          <h3 className={styles.title}>{t.features.monthly.title}</h3>
          <p className={styles.description}>
            {t.features.monthly.desc}
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 className={styles.title}>{t.features.exclusive.title}</h3>
          <p className={styles.description}>
            {t.features.exclusive.desc}
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.iconWrapper}>
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <h3 className={styles.title}>{t.features.access.title}</h3>
          <p className={styles.description}>
            {t.features.access.desc}
          </p>
        </div>
      </div>
    </section>
  );
}
