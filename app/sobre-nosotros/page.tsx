'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  GraduationCap,
  MapPin,
  Quote,
  Trophy,
  Users,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

const STATS = [
  { value: '15', suffix: '+', icon: GraduationCap, key: 's1' as const },
  { value: '50', suffix: 'k+', icon: Users, key: 's2' as const },
  { value: '30', suffix: '+', icon: MapPin, key: 's3' as const },
  { value: '5', suffix: '×', icon: Trophy, key: 's4' as const },
];

export default function SobreNosotros() {
  const { t } = useLanguage();

  const titleWords = t.about.heroTitle.split(' ');
  const lastWord = titleWords.slice(-1)[0] ?? '';
  const titleHead = titleWords.slice(0, -1).join(' ');

  const bioTitleWords = t.about.bioTitle.split(' ');
  const bioLast = bioTitleWords.slice(-1)[0] ?? '';
  const bioHead = bioTitleWords.slice(0, -1).join(' ');

  return (
    <div className={styles.container}>
      {/* ============== HERO ============== */}
      <section className={styles.hero}>
        <div className={styles.heroImage}>
          <Image
            src="/luis-sara-about.jpg"
            alt="Luis y Sara bailando"
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroCornerTL} aria-hidden="true" />
        <span className={styles.heroCornerTR} aria-hidden="true" />
        <span className={styles.heroCornerBL} aria-hidden="true" />
        <span className={styles.heroCornerBR} aria-hidden="true" />

        <div className={styles.heroInner}>
          <Reveal>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              CAPÍTULO 01 · QUIÉNES SOMOS
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className={styles.heroTitle}>
              {titleHead}{' '}
              <span className={styles.heroTitleAccent}>{lastWord}</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className={styles.heroSubtitle}>{t.about.heroSubtitle}</p>
          </Reveal>
        </div>
      </section>

      {/* ============== BODY ============== */}
      <div className={styles.body}>
        {/* ===== Bio split ===== */}
        <section className={styles.bioSection}>
          <Reveal direction="left" distance={20}>
            <div className={styles.bioText}>
              <span className={styles.bioEyebrow}>
                <span className={styles.bioEyebrowLine} aria-hidden="true" />
                BIOGRAFÍA · EN MOVIMIENTO
              </span>
              <h2 className={styles.bioTitle}>
                {bioHead}{' '}
                <span className={styles.bioTitleAccent}>{bioLast}</span>
              </h2>
              <p className={styles.bioParagraph}>{t.about.bio1}</p>
              <p className={styles.bioParagraph}>{t.about.bio2}</p>
            </div>
          </Reveal>

          <Reveal direction="right" distance={20} delay={0.1}>
            <div className={styles.bioImageWrap}>
              <Image
                src="/luis-sara-about.jpg"
                alt="Luis y Sara bailando"
                fill
                sizes="(max-width: 860px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
              />
              <span className={styles.bioImageOverlay} aria-hidden="true" />
              <span className={styles.bioImageCornerTL} aria-hidden="true" />
              <span className={styles.bioImageCornerBR} aria-hidden="true" />
              <span className={styles.bioImageCaption}>
                <span
                  className={styles.bioImageCaptionDot}
                  aria-hidden="true"
                />
                MADRID · ESCENARIO
              </span>
            </div>
          </Reveal>
        </section>

        {/* ===== Stats ===== */}
        <section className={styles.statsBlock}>
          <Reveal>
            <div className={styles.statsHeader}>
              <span className={styles.statsEyebrow}>
                <span className={styles.statsEyebrowLine} aria-hidden="true" />
                NÚMEROS QUE SE BAILAN
              </span>
              <h2 className={styles.statsTitle}>
                Una década en{' '}
                <span className={styles.statsTitleAccent}>movimiento</span>
              </h2>
            </div>
          </Reveal>

          <div className={styles.statsGrid}>
            {STATS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <Reveal key={stat.key} delay={0.05 + i * 0.06}>
                  <div className={styles.statCard}>
                    <div className={styles.statCardHeader}>
                      <span className={styles.statCardLabel}>
                        0{i + 1}
                      </span>
                      <span className={styles.statCardIcon} aria-hidden="true">
                        <Icon size={14} strokeWidth={1.8} />
                      </span>
                    </div>
                    <span className={styles.statValue}>
                      {stat.value}
                      <span className={styles.statSuffix}>{stat.suffix}</span>
                    </span>
                    <p className={styles.statDescription}>
                      {t.about.stats[stat.key]}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ===== Quote ===== */}
        <Reveal>
          <section className={styles.quoteSection}>
            <span className={styles.quoteHalo} aria-hidden="true" />
            <span className={styles.quoteIcon} aria-hidden="true">
              <Quote size={22} strokeWidth={1.6} />
            </span>
            <p className={styles.quote}>&ldquo;{t.about.quote}&rdquo;</p>
            <span className={styles.quoteAuthor}>
              <span className={styles.quoteAuthorLine} aria-hidden="true" />
              LUIS &amp; SARA
              <span className={styles.quoteAuthorLine} aria-hidden="true" />
            </span>
          </section>
        </Reveal>

        {/* ===== CTA ===== */}
        <Reveal>
          <section className={styles.ctaSection}>
            <span className={styles.ctaEyebrow}>
              <span className={styles.ctaEyebrowLine} aria-hidden="true" />
              EL SIGUIENTE PASO
              <span className={styles.ctaEyebrowLine} aria-hidden="true" />
            </span>
            <p className={styles.ctaText}>
              Aprende con nosotros desde donde estés.
            </p>
            <Link href="/courses" className={styles.ctaButton}>
              {t.about.cta}
              <ArrowUpRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
