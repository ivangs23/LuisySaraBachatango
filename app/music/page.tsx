'use client';

import { Disc3, Music2, Headphones, Heart, ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import styles from './page.module.css';
import { useLanguage } from '@/context/LanguageContext';

const PLAYLIST_EMBED_URL =
  'https://open.spotify.com/embed/playlist/0ifxajxVxpgIoQe9ymIre5?utm_source=generator&theme=0';
const PLAYLIST_OPEN_URL =
  'https://open.spotify.com/playlist/0ifxajxVxpgIoQe9ymIre5';

const MOODS = [
  'Bachata sensual',
  'Bachata moderna',
  'Bachatango',
  'Tango electrónico',
  'Para entrenar',
  'Romántica',
];

function VinylSVG({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="vinylShine" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <radialGradient id="vinylLabel" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(192,160,98,0.95)" />
          <stop offset="60%" stopColor="rgba(192,160,98,0.75)" />
          <stop offset="100%" stopColor="rgba(120,90,40,0.85)" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="#0a0a0a" />
      <circle cx="100" cy="100" r="98" fill="url(#vinylShine)" />
      {[88, 78, 68, 58, 48].map((r) => (
        <circle
          key={r}
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="0.6"
        />
      ))}
      <circle cx="100" cy="100" r="34" fill="url(#vinylLabel)" />
      <circle
        cx="100"
        cy="100"
        r="34"
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.8"
      />
      <circle cx="100" cy="100" r="3" fill="#0a0a0a" />
    </svg>
  );
}

export default function MusicPage() {
  const { t } = useLanguage();

  return (
    <div className={styles.container}>
      {/* ===== Hero ===== */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroCornerTL} aria-hidden="true" />
        <span className={styles.heroCornerTR} aria-hidden="true" />

        <VinylSVG className={`${styles.vinyl} ${styles.vinylLeft}`} />
        <VinylSVG className={`${styles.vinyl} ${styles.vinylRight}`} />

        <div className={styles.heroInner}>
          <Reveal>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              RITMO · BANDA SONORA
              <span className={styles.eyebrowLine} aria-hidden="true" />
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className={styles.title}>
              {t.music.title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className={styles.titleAccent}>
                {t.music.title.split(' ').slice(-1)[0] ?? ''}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className={styles.subtitle}>{t.music.desc}</p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className={styles.heroMeta}>
              <span className={`${styles.metaPill} ${styles.metaPillAccent}`}>
                <span className={styles.metaPillDot} aria-hidden="true" />
                Spotify · oficial
              </span>
              <span className={styles.metaPill}>Actualizada cada semana</span>
              <span className={styles.metaPill}>Para clase y para casa</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== Body ===== */}
      <div className={styles.body}>
        {/* Playlist principal */}
        <section className={styles.section}>
          <Reveal>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleBlock}>
                <span className={styles.sectionEyebrow}>
                  <span
                    className={styles.sectionEyebrowLine}
                    aria-hidden="true"
                  />
                  PLAYLIST DEL MES
                </span>
                <h2 className={styles.sectionTitle}>
                  Lo que <span className={styles.sectionTitleAccent}>sonará</span>{' '}
                  en clase
                </h2>
              </div>
              <a
                href={PLAYLIST_OPEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sectionSpotifyLink}
              >
                Abrir en Spotify
                <ArrowUpRight size={13} strokeWidth={2.6} aria-hidden="true" />
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className={styles.frame}>
              <div className={styles.frameHalo} aria-hidden="true" />
              <span className={styles.frameTopLine} aria-hidden="true" />
              <span className={styles.frameCornerTL} aria-hidden="true" />
              <span className={styles.frameCornerTR} aria-hidden="true" />
              <span className={styles.frameCornerBL} aria-hidden="true" />
              <span className={styles.frameCornerBR} aria-hidden="true" />

              <div className={styles.playlistWrapper}>
                <iframe
                  title="Playlist oficial Luis y Sara Bachatango"
                  src={PLAYLIST_EMBED_URL}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>

              <div className={styles.frameMeta}>
                <span className={styles.frameMetaLeft}>
                  <span className={styles.frameMetaIcon} aria-hidden="true">
                    <Disc3 size={14} strokeWidth={2.2} />
                  </span>
                  <span className={styles.frameMetaText}>
                    Curada por <em>Luis &amp; Sara</em>
                  </span>
                </span>
                <span className={styles.frameMetaLeft}>
                  <span className={styles.frameMetaIcon} aria-hidden="true">
                    <Headphones size={14} strokeWidth={2.2} />
                  </span>
                  <span className={styles.frameMetaText}>
                    Audífonos recomendados
                  </span>
                </span>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Moods */}
        <section className={styles.section}>
          <Reveal>
            <div className={styles.moodWrap}>
              <span className={styles.moodLabel}>
                <span className={styles.moodLabelLine} aria-hidden="true" />
                ESTILOS QUE ENCONTRARÁS
              </span>
              <div className={styles.moodChips}>
                {MOODS.map((m) => (
                  <span key={m} className={styles.moodChip}>
                    <span className={styles.moodChipDot} aria-hidden="true" />
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* Nota */}
        <Reveal>
          <div className={styles.notesCard}>
            <span className={styles.notesIcon} aria-hidden="true">
              <Music2 size={20} strokeWidth={1.8} />
            </span>
            <div className={styles.notesText}>
              <h3 className={styles.notesTitle}>
                ¿Echas en falta una canción?
              </h3>
              <p className={styles.notesBody}>
                Escríbenos por redes y la añadiremos a la próxima rotación. La
                playlist se mueve con la academia: lo que bailamos en clase, lo
                bailas tú también desde casa.{' '}
                <Heart
                  size={12}
                  strokeWidth={2.4}
                  style={{ display: 'inline', verticalAlign: '-1px' }}
                  aria-hidden="true"
                />
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
