'use client';

import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Sparkles, Music2, Heart } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from '@/app/login/login.module.css';

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

type AuthShellProps = {
  panelEyebrow: string;
  panelTitle: string;
  panelTitleEmphasis: string;
  panelTitleSuffix: string;
  panelLead: string;
  panelFeatures: string[];
  panelQuote?: string;
  panelQuoteAuthor?: string;
  cardEyebrow: string;
  cardTitle: string;
  cardSubtitle: string;
  errorMsg?: string | null;
  successMsg?: string | null;
  children: ReactNode;
};

export default function AuthShell({
  panelEyebrow,
  panelTitle,
  panelTitleEmphasis,
  panelTitleSuffix,
  panelLead,
  panelFeatures,
  panelQuote,
  panelQuoteAuthor,
  cardEyebrow,
  cardTitle,
  cardSubtitle,
  errorMsg,
  successMsg,
  children,
}: AuthShellProps) {
  const reduce = useReducedMotion();
  const featureIcons = [Sparkles, Music2, Heart];

  const fadeUp = (delay = 0) =>
    reduce
      ? { initial: false }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO },
        };

  const fadeRight = (delay = 0) =>
    reduce
      ? { initial: false }
      : {
          initial: { opacity: 0, x: 18 },
          animate: { opacity: 1, x: 0 },
          transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO },
        };

  return (
    <div className={styles.shell}>
      {/* ===== Decorative left panel ===== */}
      <aside className={styles.panel}>
        <div className={styles.panelBg} aria-hidden="true" />
        <div className={styles.panelGrid} aria-hidden="true" />
        <span className={styles.panelCornerTL} aria-hidden="true" />
        <span className={styles.panelCornerTR} aria-hidden="true" />
        <span className={styles.panelCornerBL} aria-hidden="true" />
        <span className={styles.panelCornerBR} aria-hidden="true" />

        <motion.div className={styles.panelTop} {...fadeUp(0)}>
          <span className={styles.brandMark}>
            <span className={styles.brandMarkDot} aria-hidden="true" />
            Luis y Sara Bachatango
          </span>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowLine} aria-hidden="true" />
            {panelEyebrow}
          </span>
        </motion.div>

        <motion.div className={styles.panelMiddle} {...fadeUp(0.1)}>
          <h2 className={styles.panelHeadline}>
              {panelTitle}
              {panelTitleEmphasis && <em className={styles.panelHeadlineAccent}>{panelTitleEmphasis}</em>}
              {panelTitleSuffix}
            </h2>
          <p className={styles.panelLead}>{panelLead}</p>
          <ul className={styles.panelFeatures}>
            {panelFeatures.map((feature, i) => {
              const Icon = featureIcons[i % featureIcons.length];
              return (
                <motion.li
                  key={feature}
                  className={styles.panelFeature}
                  {...fadeUp(0.18 + i * 0.05)}
                >
                  <span className={styles.panelFeatureIcon} aria-hidden="true">
                    <Icon size={12} strokeWidth={2.4} />
                  </span>
                  <span>{feature}</span>
                </motion.li>
              );
            })}
          </ul>
        </motion.div>

        {panelQuote && (
          <motion.div className={styles.panelBottom} {...fadeUp(0.3)}>
            <p className={styles.panelBottomQuote}>&ldquo;{panelQuote}&rdquo;</p>
            {panelQuoteAuthor && (
              <span className={styles.panelBottomAuthor}>{panelQuoteAuthor}</span>
            )}
          </motion.div>
        )}
      </aside>

      {/* ===== Form area ===== */}
      <main className={styles.formArea}>
        <div className={styles.formBg} aria-hidden="true" />
        <motion.div className={styles.card} {...fadeRight(0.05)}>
          <div className={styles.cardHeader}>
            <span className={styles.cardEyebrow}>
              <span className={styles.cardEyebrowLine} aria-hidden="true" />
              {cardEyebrow}
            </span>
            <h1 className={styles.title}>{cardTitle}</h1>
            <p className={styles.subtitle}>{cardSubtitle}</p>
          </div>

          {successMsg && (
            <motion.div
              className={styles.message}
              role="status"
              {...fadeUp(0.1)}
            >
              <CheckCircle2
                size={16}
                strokeWidth={2.2}
                className={styles.alertIcon}
                aria-hidden="true"
              />
              <span>{successMsg}</span>
            </motion.div>
          )}

          {errorMsg && (
            <motion.div
              className={styles.error}
              role="alert"
              {...fadeUp(0.1)}
            >
              <AlertTriangle
                size={16}
                strokeWidth={2.2}
                className={styles.alertIcon}
                aria-hidden="true"
              />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {children}
        </motion.div>
      </main>
    </div>
  );
}
