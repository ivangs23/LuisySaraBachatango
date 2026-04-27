import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, CalendarDays, FileText } from 'lucide-react';
import Reveal from '@/components/Reveal';
import styles from './admin.module.css';

type MetaItem = {
  icon?: 'calendar' | 'file';
  label: string;
};

type AdminShellProps = {
  chapter?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  back?: { href: string; label: string };
  meta?: MetaItem[];
  /** When true, body uses a narrower max-width (820px) more suited to forms. */
  narrow?: boolean;
  children: ReactNode;
};

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

function MetaIcon({ icon }: { icon?: MetaItem['icon'] }) {
  if (icon === 'calendar') {
    return <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />;
  }
  if (icon === 'file') {
    return <FileText size={13} strokeWidth={2} aria-hidden="true" />;
  }
  return null;
}

export default function AdminShell({
  chapter,
  eyebrow,
  title,
  intro,
  back,
  meta,
  narrow = false,
  children,
}: AdminShellProps) {
  const { head, tail } = splitTitleAccent(title);

  return (
    <div className={styles.container}>
      {/* ============== HERO ============== */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroCornerTL} aria-hidden="true" />
        <span className={styles.heroCornerTR} aria-hidden="true" />

        <div className={styles.heroInner}>
          {back && (
            <Reveal direction="left" distance={16}>
              <Link href={back.href} className={styles.backLink}>
                <ArrowLeft size={13} strokeWidth={2.4} aria-hidden="true" />
                {back.label}
              </Link>
            </Reveal>
          )}

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

          {intro && (
            <Reveal delay={0.1}>
              <p className={styles.intro}>{intro}</p>
            </Reveal>
          )}

          {meta && meta.length > 0 && (
            <Reveal delay={0.15}>
              <div className={styles.heroMeta}>
                {meta.map((m, i) => (
                  <span key={`${m.label}-${i}`} className={styles.metaItem}>
                    {i > 0 && (
                      <span
                        className={styles.metaDivider}
                        aria-hidden="true"
                      />
                    )}
                    <MetaIcon icon={m.icon} />
                    {m.label}
                  </span>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ============== BODY ============== */}
      <div className={`${styles.body} ${narrow ? styles.bodyNarrow : ''}`}>
        {children}
      </div>
    </div>
  );
}

type AdminPanelProps = {
  number?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export function AdminPanel({
  number,
  title,
  subtitle,
  children,
}: AdminPanelProps) {
  return (
    <Reveal>
      <section className={styles.panel}>
        <span className={styles.panelHalo} aria-hidden="true" />
        {(title || number) && (
          <header className={styles.panelHeader}>
            {number && (
              <span className={styles.panelNumber}>{number}</span>
            )}
            {title && <h2 className={styles.panelTitle}>{title}</h2>}
          </header>
        )}
        {subtitle && <p className={styles.panelSub}>{subtitle}</p>}
        {children}
      </section>
    </Reveal>
  );
}
