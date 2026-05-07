'use client';

import { useState, useTransition } from 'react';
import styles from './Newsletter.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { useInView } from '@/hooks/useInView';
import { subscribeNewsletter } from '@/app/actions/newsletter';

export default function Newsletter() {
  const { t } = useLanguage();
  const { ref, inView } = useInView();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' });

  async function handleSubmit(formData: FormData) {
    setStatus({ kind: 'idle' });
    startTransition(async () => {
      const r = await subscribeNewsletter(formData);
      if ('success' in r) {
        setStatus({ kind: 'ok' });
      } else {
        setStatus({ kind: 'err', msg: r.error });
      }
    });
  }

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`${styles.newsletter} ${inView ? styles.visible : ''}`}
    >
      <div className={styles.container}>
        <h2 className={styles.title}>{t.newsletter.title}</h2>
        <p className={styles.description}>{t.newsletter.desc}</p>
        <form className={styles.form} action={handleSubmit}>
          <label htmlFor="newsletter-email" className="sr-only">
            {t.newsletter.placeholder}
          </label>
          <input
            id="newsletter-email"
            type="email"
            name="email"
            placeholder={t.newsletter.placeholder}
            className={styles.input}
            required
          />
          <button type="submit" className={styles.button} disabled={isPending}>
            {isPending ? '...' : t.newsletter.button}
          </button>
        </form>
        {status.kind === 'ok' && <p>{t.newsletter.success}</p>}
        {status.kind === 'err' && <p role="alert">{t.newsletter.error}</p>}
      </div>
    </section>
  );
}
