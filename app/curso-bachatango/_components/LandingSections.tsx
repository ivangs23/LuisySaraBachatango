import Reveal from '@/components/Reveal';
import OfferPrice from '@/components/OfferPrice';
import { formatSpotsLeft, type CourseOffer } from '@/utils/courses/offer';
import type { LandingCopy } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import LandingFaq from './LandingFaq';
import CourseCurriculum from './CourseCurriculum';
import LandingFreeClass from './LandingFreeClass';
import type { Curriculum } from '@/utils/courses/curriculum';
import type { Testimonial } from '@/utils/landing/content';
import { fillCurriculum } from '../_lib/curriculum-copy';
import styles from '../page.module.css';

interface SectionsProps {
  copy: LandingCopy;
  courseId: string;
  offer: CourseOffer;
  /** null si la BD no responde: la página sigue vendiendo sin el temario. */
  curriculum: Curriculum | null;
  /**
   * Clase gratis lista para incrustar, con sus tokens ya firmados. null si no
   * hay lección gratuita o si falta la configuración de Mux: en ese caso la
   * sección cae al enlace de siempre en vez de dejar un hueco.
   */
  freeClass: {
    playbackId: string;
    playbackToken: string;
    thumbnailToken: string;
    title: string;
  } | null;
  /**
   * Testimonios publicados en `landing_testimonials`, los mismos de la home.
   * Vacío si no hay ninguno o si la BD falla: entonces la sección no sale.
   */
  testimonials: Testimonial[];
}

export default function LandingSections({ courseId, offer, curriculum, freeClass, testimonials, copy }: SectionsProps) {
  const c = copy;
  const spotsText = formatSpotsLeft(copy.offer.spotsLeft, offer.spotsLeft);
  // Las cifras salen del temario real. Sin él (BD caída), la pregunta de la
  // duración desaparece y la línea de lecciones pierde el número.
  const faqItems = c.faq.flatMap((f) => {
    const a = fillCurriculum(f.a, curriculum);
    return a ? [{ q: f.q, a }] : [];
  });
  const includes = [
    fillCurriculum(c.offer.lessonsIncluded, curriculum) ?? c.offer.lessonsIncludedFallback,
    ...c.offer.includes,
  ];
  return (
    <>
      {/* Dolor → promesa */}
      <section className={styles.section}>
        <Reveal>
          <h2 className={styles.h2}>{c.pain.title}</h2>
          <ul className={styles.painList}>
            {c.pain.items.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <p className={styles.promise}>{c.pain.promise}</p>
        </Reveal>
      </section>

      {/* Temario real, desde la BD */}
      {curriculum && <CourseCurriculum curriculum={curriculum} copy={copy} />}

      {/* Método */}
      <section className={styles.section}>
        <Reveal>
          <h2 className={styles.h2}>{c.method.title}</h2>
          <p className={styles.lead}>{c.method.body}</p>
        </Reveal>
      </section>

      {/* Bio */}
      <section className={styles.section}>
        <Reveal>
          <h2 className={styles.h2}>{c.bio.title}</h2>
          <p className={styles.lead}>{c.bio.body}</p>
        </Reveal>
      </section>

      {/* Testimonios: solo si hay alguno publicado. Mejor nada que un titular
          sobre un hueco, y nunca citas que no haya escrito un alumno. */}
      {testimonials.length > 0 && (
        <section className={styles.section}>
          <Reveal><h2 className={styles.h2}>{c.testimonials.title}</h2></Reveal>
          <div className={styles.grid}>
            {testimonials.map((t, i) => (
              <Reveal key={t.id} delay={i * 0.05}>
                <blockquote className={styles.card}>
                  <p className={styles.quote}>“{t.quote}”</p>
                  <cite className={styles.cite}>{t.name}</cite>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Clase gratis (risk-reversal) */}
      <section id="clase-gratis" className={styles.section}>
        <Reveal>
          <h2 className={styles.h2}>{c.freeClass.title}</h2>
          <p className={styles.lead}>{c.freeClass.body}</p>
          {freeClass ? (
            <LandingFreeClass
              playbackId={freeClass.playbackId}
              playbackToken={freeClass.playbackToken}
              thumbnailToken={freeClass.thumbnailToken}
              title={freeClass.title}
            />
          ) : (
            <a href="/clase-gratis" className={styles.ctaOutline}>{c.freeClass.cta}</a>
          )}
          <ul className={styles.trustRow}>
            {c.freeClass.trust.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </Reveal>
      </section>

      {/* Oferta + precio */}
      <section className={styles.offer}>
        <Reveal>
          <h2 className={styles.h2}>{c.offer.title}</h2>
          <ul className={styles.includes}>
            {includes.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          {offer.price !== null && (
            <OfferPrice
              className={styles.offerPrice}
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
          <p className={styles.priceNote}>{c.offer.priceNote}</p>
          <CourseCtaButton courseId={courseId} label={c.offer.cta} />
        </Reveal>
      </section>

      {/* FAQ */}
      <section className={styles.section}>
        <Reveal><h2 className={styles.h2}>{c.faqTitle}</h2></Reveal>
        <LandingFaq items={faqItems} />
      </section>

      {/* CTA final */}
      <section className={styles.finalCta}>
        <Reveal>
          <h2 className={styles.h2}>{c.finalCta.title}</h2>
          <CourseCtaButton courseId={courseId} label={c.finalCta.cta} />
        </Reveal>
      </section>
    </>
  );
}
