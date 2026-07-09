import Reveal from '@/components/Reveal';
import { LANDING_COPY, COURSE_ID } from '../copy';
import CourseCtaButton from './CourseCtaButton';
import LandingFaq from './LandingFaq';
import styles from '../page.module.css';

interface SectionsProps {
  courseId: string;
  isAuthed: boolean;
  price: number;
}

export default function LandingSections({ courseId, isAuthed, price }: SectionsProps) {
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

      {/* Qué aprendes */}
      <section className={styles.section}>
        <Reveal><h2 className={styles.h2}>{c.learn.title}</h2></Reveal>
        <div className={styles.grid}>
          {c.learn.items.map((it, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <div className={styles.card}>
                <h3 className={styles.h3}>{it.title}</h3>
                <p className={styles.cardBody}>{it.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

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
                <p className={styles.quote}>"{t.quote}"</p>
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
          <a href={`/courses/${COURSE_ID}`} className={styles.ctaOutline}>{c.freeClass.cta}</a>
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
          <CourseCtaButton courseId={courseId} isAuthed={isAuthed} label={c.offer.cta} />
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
          <CourseCtaButton courseId={courseId} isAuthed={isAuthed} label={c.finalCta.cta} />
        </Reveal>
      </section>
    </>
  );
}
