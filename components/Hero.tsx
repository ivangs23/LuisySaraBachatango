'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { Play, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import styles from './Hero.module.css';

const STATS = [
  { value: '+15', labelKey: 'years' },
  { value: '+4.000', labelKey: 'students' },
  { value: '+25', labelKey: 'countries' },
] as const;

type StatKey = typeof STATS[number]['labelKey'];

const STAT_LABELS_ES: Record<StatKey, string> = {
  years: 'AÑOS BAILANDO',
  students: 'ALUMNOS',
  countries: 'PAÍSES',
};

export default function Hero() {
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [videoReady, setVideoReady] = useState(false);

  // Split del título por palabras para animarlas escalonadas.
  // Mantenemos los saltos de línea originales del diccionario (whiteSpace: pre-line).
  const titleWords = (t.hero.title as string).split(/(\s+)/);

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.08,
        delayChildren: prefersReducedMotion ? 0 : 0.4,
      },
    },
  };

  const wordVariants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 28, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <section className={styles.hero} aria-label="Bachatango con Luis y Sara">
      {/* Capa de fondo: vídeo con poster fallback */}
      <div className={styles.bgLayer} aria-hidden="true">
        <video
          className={`${styles.bgVideo} ${videoReady ? styles.bgVideoVisible : ''}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero-bg.png"
          onCanPlay={() => setVideoReady(true)}
        >
          <source src="/hero-video.mp4" type="video/mp4" />
          <source src="/hero-video.webm" type="video/webm" />
        </video>
        {/* Gradiente cinemático y viñeta */}
        <div className={styles.bgOverlay} />
        <div className={styles.bgVignette} />
      </div>

      {/* Onda decorativa arriba (musical) */}
      <motion.svg
        className={styles.waveDeco}
        viewBox="0 0 200 40"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ delay: 1.2, duration: 1.4 }}
      >
        {[...Array(24)].map((_, i) => (
          <motion.rect
            key={i}
            x={i * 8}
            y={20}
            width={3}
            height={4}
            rx={1.5}
            fill="currentColor"
            initial={{ scaleY: 1 }}
            animate={
              prefersReducedMotion
                ? { scaleY: 1 }
                : { scaleY: [1, 2 + (i % 5), 1] }
            }
            transition={{
              duration: 1.4 + (i % 4) * 0.2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.05,
            }}
            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
          />
        ))}
      </motion.svg>

      {/* Contenido */}
      <div className={styles.content}>
        <motion.div
          className={styles.kicker}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.kickerLine} aria-hidden="true" />
          <span className={styles.kickerText}>LUIS &amp; SARA · MASTERCLASS ONLINE</span>
        </motion.div>

        <motion.h1
          className={styles.title}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {titleWords.map((word, i) =>
            word === '\n' || /^\s+$/.test(word) ? (
              <span
                key={i}
                style={{ whiteSpace: 'pre' }}
                aria-hidden="true"
              >
                {word}
              </span>
            ) : (
              <span key={i} className={styles.wordWrap}>
                <motion.span className={styles.word} variants={wordVariants}>
                  {word}
                </motion.span>
              </span>
            ),
          )}
        </motion.h1>

        <motion.p
          className={styles.subtitle}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 1.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {t.hero.subtitle}
        </motion.p>

        <motion.div
          className={styles.ctaRow}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 1.25, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link href="/courses" className={styles.ctaPrimary}>
            <span>{t.hero.cta}</span>
            <span className={styles.ctaArrow} aria-hidden="true">→</span>
          </Link>
          <Link href="/courses" className={styles.ctaSecondary}>
            <Play size={16} strokeWidth={2.5} aria-hidden="true" />
            <span>Ver clase de muestra</span>
          </Link>
        </motion.div>

        {/* Stats inline */}
        <motion.ul
          className={styles.stats}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ delay: 1.45, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {STATS.map((stat) => (
            <li key={stat.labelKey} className={styles.statItem}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>
                {STAT_LABELS_ES[stat.labelKey]}
              </span>
            </li>
          ))}
        </motion.ul>
      </div>

      {/* Scroll indicator */}
      <motion.a
        href="#features"
        className={styles.scrollIndicator}
        aria-label="Bajar para ver más"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.8 }}
      >
        <span className={styles.scrollText}>SCROLL</span>
        <motion.span
          className={styles.scrollIcon}
          animate={
            prefersReducedMotion
              ? { y: 0 }
              : { y: [0, 6, 0], opacity: [0.4, 1, 0.4] }
          }
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={18} strokeWidth={2} />
        </motion.span>
      </motion.a>
    </section>
  );
}
