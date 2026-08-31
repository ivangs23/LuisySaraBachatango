'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import Reveal from './Reveal';
import styles from './HomeOffer.module.css';

/**
 * Bloque de oferta de la home. El precio llega desde `courses.price_eur`
 * (Server Component padre) — nunca se hardcodea. El CTA lleva al funnel
 * completo, no al checkout: queremos que el visitante lea la venta entera.
 */
export default function HomeOffer({ price }: { price: number }) {
  const { t } = useLanguage();
  const c = t.home.offer;

  return (
    <section className={styles.offer} aria-labelledby="home-offer-title">
      <Reveal direction="left" distance={48}>
        <div className={styles.chapter} aria-hidden="true">
          <span className={styles.chapterNum}>{c.chapter}</span>
          <span className={styles.chapterLine} />
          <span className={styles.chapterLabel}>{c.label}</span>
        </div>
      </Reveal>

      <div className={styles.card}>
        <Reveal delay={0.06}>
          <h2 id="home-offer-title" className={styles.title}>{c.title}</h2>
        </Reveal>

        <Reveal delay={0.12}>
          <p className={styles.lead}>{c.lead}</p>
        </Reveal>

        <Reveal delay={0.18}>
          <ul className={styles.includes}>
            {c.includes.map((item) => (
              <li key={item}>
                <span className={styles.tick} aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.24}>
          <div className={styles.priceRow}>
            <span className={styles.price}>{price} €</span>
            <span className={styles.priceNote}>{c.priceNote}</span>
          </div>
        </Reveal>

        <Reveal delay={0.3}>
          <div className={styles.ctaWrap}>
            <Link href="/curso-bachatango" className={styles.cta}>
              <span>{c.cta}</span>
              <span className={styles.ctaArrow} aria-hidden="true">→</span>
            </Link>
            <p className={styles.micro}>{c.micro}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
