'use client';

import styles from './Features.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { useInView } from '@/hooks/useInView';
import Reveal from './Reveal';

export default function Features() {
  const { t } = useLanguage();
  const { ref, inView } = useInView();

  const features = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      ),
      title: t.features.monthly.title,
      desc: t.features.monthly.desc,
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      title: t.features.exclusive.title,
      desc: t.features.exclusive.desc,
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      ),
      title: t.features.access.title,
      desc: t.features.access.desc,
    },
  ];

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`${styles.features} ${inView ? styles.visible : ''}`}
    >
      {/* Capítulo / número decorativo */}
      <Reveal direction="left" distance={48}>
        <div className={styles.chapter} aria-hidden="true">
          <span className={styles.chapterNum}>02</span>
          <span className={styles.chapterLine} />
          <span className={styles.chapterLabel}>EL MÉTODO</span>
        </div>
      </Reveal>

      {/* Intro editorial */}
      <Reveal delay={0.08}>
        <div className={styles.intro}>
          <h2 className={styles.introTitle}>
            Tres claves para entrar al universo <em>Bachatango</em>
          </h2>
          <p className={styles.introText}>
            Una propuesta cuidada, mes a mes. Lo que necesitas para crecer en
            pista, sin saturarte de contenido.
          </p>
        </div>
      </Reveal>

      <div className={styles.container}>
        {features.map((feature, idx) => (
          <div
            key={idx}
            className={`${styles.featureCard} ${inView ? styles.cardRevealed : ''}`}
            style={{ '--delay': `${idx * 0.16 + 0.05}s` } as React.CSSProperties}
          >
            <span className={styles.featureIndex} aria-hidden="true">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <div className={styles.iconWrapper}>{feature.icon}</div>
            <h3 className={styles.title}>{feature.title}</h3>
            <p className={styles.description}>{feature.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
