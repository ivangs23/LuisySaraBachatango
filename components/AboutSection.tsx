'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { useLanguage } from '@/context/LanguageContext';
import Reveal from './Reveal';
import styles from './AboutSection.module.css';

/**
 * AboutSection — bloque cinemático "Quiénes somos" para la home.
 * Layout 2 columnas: imagen con marco dorado offset (parallax sutil) + copy.
 * Reutiliza el copy del diccionario (`t.about.*`) ya traducido a los 6 idiomas.
 */
export default function AboutSection() {
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  // Parallax: la imagen se mueve sutilmente al hacer scroll por la sección.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Rango: cuando la sección entra (0) la imagen está 40px abajo;
  // cuando sale (1), 40px arriba. Crea sensación de profundidad.
  const imgY = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? ['0px', '0px'] : ['40px', '-40px'],
  );

  return (
    <section ref={sectionRef} className={styles.about} aria-labelledby="about-home-title">
      {/* Línea / número decorativo de capítulo */}
      <Reveal direction="left" distance={48}>
        <div className={styles.chapter} aria-hidden="true">
          <span className={styles.chapterNum}>01</span>
          <span className={styles.chapterLine} />
          <span className={styles.chapterLabel}>CONOCE A TUS PROFES</span>
        </div>
      </Reveal>

      <div className={styles.layout}>
        {/* Columna imagen con marco dorado offset y parallax */}
        <Reveal
          direction="right"
          distance={48}
          duration={1.1}
          className={styles.imageColumn}
        >
          <motion.div
            className={styles.imageFrame}
            style={{ y: imgY }}
          >
            <span className={styles.imageOutline} aria-hidden="true" />
            <div className={styles.imageWrap}>
              <Image
                src="/luis-sara-about.jpg"
                alt="Luis y Sara bailando bachatango"
                fill
                sizes="(max-width: 900px) 100vw, 45vw"
                className={styles.image}
                priority={false}
              />
              <span className={styles.imageGradient} aria-hidden="true" />
              <span className={styles.imageCornerTL} aria-hidden="true" />
              <span className={styles.imageCornerBR} aria-hidden="true" />
            </div>
          </motion.div>
        </Reveal>

        {/* Columna copy */}
        <div className={styles.textColumn}>
          <Reveal delay={0.05}>
            <span className={styles.eyebrow}>{t.about.heroSubtitle}</span>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 id="about-home-title" className={styles.title}>
              {t.about.heroTitle}
            </h2>
          </Reveal>

          <Reveal delay={0.18}>
            <span className={styles.divider} aria-hidden="true" />
          </Reveal>

          <Reveal delay={0.22}>
            <p className={styles.lead}>{t.about.bio1}</p>
          </Reveal>

          <Reveal delay={0.3}>
            <p className={styles.body}>{t.about.bio2}</p>
          </Reveal>

          <Reveal delay={0.4}>
            <div className={styles.signatureRow}>
              <span className={styles.signature}>Luis &amp; Sara</span>
              <span className={styles.signatureRole}>Founders · Instructores</span>
            </div>
          </Reveal>

          <Reveal delay={0.5}>
            <Link href="/sobre-nosotros" className={styles.ctaLink}>
              <span>{t.about.cta}</span>
              <span className={styles.ctaArrow} aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
