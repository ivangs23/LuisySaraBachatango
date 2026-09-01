import Reveal from '@/components/Reveal';
import { LANDING_COPY } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import LandingFaq from './LandingFaq';
import CourseCurriculum from './CourseCurriculum';
import LandingFreeClass from './LandingFreeClass';
import type { Curriculum } from '@/utils/courses/curriculum';
import styles from '../page.module.css';

interface SectionsProps {
  courseId: string;
  price: number;
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
}

export default function LandingSections({ courseId, price, curriculum, freeClass }: SectionsProps) {
  const c = LANDING_COPY;
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
      {curriculum && <CourseCurriculum curriculum={curriculum} />}

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

      {/* Testimonios */}
      <section className={styles.section}>
        <Reveal><h2 className={styles.h2}>{c.testimonials.title}</h2></Reveal>
        <div className={styles.grid}>
          {c.testimonials.items.map((t, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <blockquote className={styles.card}>
                <p className={styles.quote}>“{t.quote}”</p>
                <cite className={styles.cite}>{t.author}</cite>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </section>

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
            {c.offer.includes.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
          <p className={styles.price}>€{price}</p>
          <p className={styles.priceNote}>{c.offer.priceNote}</p>
          <CourseCtaButton courseId={courseId} label={c.offer.cta} />
        </Reveal>
      </section>

      {/* FAQ */}
      <section className={styles.section}>
        <Reveal><h2 className={styles.h2}>Preguntas frecuentes</h2></Reveal>
        <LandingFaq />
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
