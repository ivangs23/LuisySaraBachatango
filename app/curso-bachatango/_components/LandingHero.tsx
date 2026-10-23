'use client';

import Image from 'next/image';
import { sanitizeUrl } from '@/utils/sanitize';
import { isOptimizableImageUrl } from '@/utils/images/optimizable';
import { formatSpotsLeft, type CourseOffer } from '@/utils/courses/offer';
import OfferPrice from '@/components/OfferPrice';
import type { LandingCopy } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import styles from '../page.module.css';

interface HeroProps {
  copy: LandingCopy;
  /** Subtítulo ya resuelto en servidor con las cifras del temario (`heroSub`). */
  sub: string;
  courseId: string;
  isAuthed: boolean;
  offer: CourseOffer;
  imageUrl: string | null;
}

export default function LandingHero({ courseId, isAuthed, offer, imageUrl, copy, sub }: HeroProps) {
  const c = copy.hero;
  // Dos filtros, no uno: `sanitizeUrl` valida la forma (https, sin
  // `javascript:`) y `isOptimizableImageUrl` la pertenencia al bucket que
  // declara `remotePatterns`. Sin el segundo, una portada de otro dominio
  // haría LANZAR a <Image> y la landing devolvería 500.
  const safeBg = imageUrl ? sanitizeUrl(imageUrl) : null;
  const bg = isOptimizableImageUrl(safeBg) ? safeBg : null;
  const spotsText = formatSpotsLeft(copy.offer.spotsLeft, offer.spotsLeft);
  return (
    <section className={styles.hero}>
      {/* El fondo deja de ser una background-image de CSS: así `priority`
          emite el <link rel="preload"> en el <head> y el navegador empieza a
          bajar la portada sin esperar a maquetar. Era el elemento LCP y la
          espera a descubrirla costaba 3,55 s.

          `fetchPriority` va aparte y en Next 16 no lo implica `priority`:
          alimenta tanto el atributo del <img> como el del propio preload
          (next/dist/client/image-component.js, ImagePreload). Sin él la
          portada se precarga en la misma cola que todo lo demás. */}
      {bg && (
        <div className={styles.heroBg} aria-hidden="true">
          <Image
            src={bg}
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className={styles.heroBgImage}
          />
          <div className={styles.heroScrim} />
        </div>
      )}
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>{c.h1}</h1>
        <p className={styles.heroSub}>{sub}</p>
        {offer.price !== null && (
          <OfferPrice
            className={styles.heroOffer}
            price={offer.price}
            compareAt={offer.compareAt}
            discountPct={offer.discountPct}
            spotsText={spotsText}
            compareAtLabel={copy.offer.before}
            currency="prefix"
            size="lg"
            align="center"
          />
        )}
        <div className={styles.heroCtaRow}>
          <CourseCtaButton
            courseId={courseId}
            label={offer.price !== null ? `${c.cta} · €${offer.price}` : c.cta}
          />
          <a href="#clase-gratis" className={styles.heroSecondary}>{c.secondary}</a>
        </div>
        <p className={styles.heroMicro}>{c.micro}</p>
        {!isAuthed && (
          <p className={styles.heroLogin}>
            {c.haveAccount} <a href="/login">{c.login}</a>
          </p>
        )}
      </div>
    </section>
  );
}
