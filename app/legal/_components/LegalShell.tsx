import Link from 'next/link';
import { ArrowUpRight, CalendarDays, FileText } from 'lucide-react';
import Reveal from '@/components/Reveal';
import styles from './legal.module.css';

export type LegalSection = {
  /** Optional explicit slug. Defaults to derived from heading. */
  id?: string;
  heading: string;
  /** Single string with paragraphs separated by '\n\n', or an array of paragraphs. */
  body: string | string[];
};

type LegalShellProps = {
  chapter?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  sections: LegalSection[];
  /** ISO string e.g. "2026-04-01". Defaults to today. */
  updatedAt?: string;
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function splitTitleAccent(title: string) {
  const words = title.trim().split(/\s+/);
  if (words.length <= 1) {
    return { head: '', tail: title };
  }
  return {
    head: words.slice(0, -1).join(' '),
    tail: words.slice(-1)[0] ?? '',
  };
}

function formatDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return iso ?? '';
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function LegalShell({
  chapter,
  eyebrow,
  title,
  intro,
  sections,
  updatedAt,
}: LegalShellProps) {
  const { head, tail } = splitTitleAccent(title);
  const formattedDate = formatDate(updatedAt);

  const enriched = sections.map((s, i) => {
    const id = s.id ?? (slugify(s.heading) || `section-${i + 1}`);
    const paragraphs = Array.isArray(s.body)
      ? s.body
      : s.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    return {
      id,
      heading: s.heading,
      paragraphs,
      number: String(i + 1).padStart(2, '0'),
    };
  });

  return (
    <div className={styles.container}>
      {/* ============== HERO ============== */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroCornerTL} aria-hidden="true" />
        <span className={styles.heroCornerTR} aria-hidden="true" />

        <div className={styles.heroInner}>
          <Reveal>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              {chapter ? `${chapter} · ${eyebrow}` : eyebrow}
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className={styles.title}>
              {head ? (
                <>
                  {head}{' '}
                  <span className={styles.titleAccent}>{tail}</span>
                </>
              ) : (
                <span className={styles.titleAccent}>{tail}</span>
              )}
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <div className={styles.heroMeta}>
              <span className={styles.metaItem}>
                <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
                Actualizado: {formattedDate}
              </span>
              <span className={styles.metaDivider} aria-hidden="true" />
              <span className={styles.metaItem}>
                <FileText size={13} strokeWidth={2} aria-hidden="true" />
                {enriched.length} secciones
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============== BODY ============== */}
      <div className={styles.body}>
        {/* Sumario */}
        <Reveal direction="left" distance={20}>
          <aside className={styles.summary} aria-label="Sumario">
            <span className={styles.summaryEyebrow}>
              <span className={styles.summaryEyebrowLine} aria-hidden="true" />
              SUMARIO
            </span>
            <ul className={styles.summaryList}>
              {enriched.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={styles.summaryLink}>
                    <span className={styles.summaryNumber}>{s.number}</span>
                    <span>{s.heading}</span>
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </Reveal>

        {/* Article */}
        <Reveal direction="right" distance={20} delay={0.05}>
          <article className={styles.article}>
            <span className={styles.articleHalo} aria-hidden="true" />
            {intro && <p className={styles.intro}>{intro}</p>}

            {enriched.map((s) => (
              <section key={s.id} id={s.id} className={styles.section}>
                <h2 className={styles.sectionHeading}>
                  <span className={styles.sectionNumber}>{s.number}</span>
                  {s.heading}
                </h2>
                <div className={styles.sectionBody}>
                  {s.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            ))}

            <div className={styles.docFooter}>
              <p className={styles.docFooterText}>
                ¿Tienes dudas sobre este documento o quieres ejercer alguno de
                tus derechos? Escríbenos y te respondemos en menos de 48 horas
                laborables.
              </p>
              <Link href="/contact" className={styles.docFooterCta}>
                Contactar
                <ArrowUpRight
                  size={13}
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
              </Link>
            </div>
          </article>
        </Reveal>
      </div>
    </div>
  );
}
