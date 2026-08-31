'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useConsent } from '@/context/ConsentContext';
import { useLanguage } from '@/context/LanguageContext';
import styles from './CookieConsent.module.css';

/**
 * Banner de consentimiento. Los tres botones tienen el mismo peso visual:
 * esconder el rechazo o exigir clics extra para denegar es un patrón oscuro
 * y la AEPD lo trata como consentimiento no válido.
 *
 * Devuelve null hasta que el contexto ha leído la cookie, para no parpadear
 * en cada carga de página para quien ya decidió.
 */
export default function CookieConsent() {
  const { t } = useLanguage();
  const { hydrated, isOpen, save } = useConsent();
  const [showDetail, setShowDetail] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const c = t.consent;

  if (!hydrated || !isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="false"
      aria-label={c.title}
    >
      <div className={styles.panel}>
        <h2 className={styles.title}>{c.title}</h2>
        <p className={styles.body}>{c.body}</p>

        {showDetail && (
          <ul className={styles.categories}>
            <li className={styles.category}>
              <div className={styles.categoryHead}>
                <span className={styles.categoryName}>{c.necessaryLabel}</span>
                <span className={styles.always} aria-hidden="true">✓</span>
              </div>
              <p className={styles.categoryDesc}>{c.necessaryDesc}</p>
            </li>

            <li className={styles.category}>
              <label className={styles.categoryHead}>
                <span className={styles.categoryName}>{c.analyticsLabel}</span>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className={styles.toggle}
                />
              </label>
              <p className={styles.categoryDesc}>{c.analyticsDesc}</p>
            </li>

            <li className={styles.category}>
              <label className={styles.categoryHead}>
                <span className={styles.categoryName}>{c.marketingLabel}</span>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className={styles.toggle}
                />
              </label>
              <p className={styles.categoryDesc}>{c.marketingDesc}</p>
            </li>
          </ul>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => save(true, true)}>
            {c.accept}
          </button>
          <button type="button" className={styles.secondary} onClick={() => save(false, false)}>
            {c.reject}
          </button>
          {showDetail ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => save(analytics, marketing)}
            >
              {c.save}
            </button>
          ) : (
            <button
              type="button"
              className={styles.tertiary}
              onClick={() => setShowDetail(true)}
            >
              {c.configure}
            </button>
          )}
        </div>

        <Link href="/legal/cookies" className={styles.policy}>
          {c.policyLink}
        </Link>
      </div>
    </div>
  );
}
