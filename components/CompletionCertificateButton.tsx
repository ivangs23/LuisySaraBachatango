'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { issueCompletion } from '@/app/courses/completion-actions';
import { normalizeRecipientName } from '@/utils/courses/completion';
import styles from './CompletionCertificateButton.module.css';

type Props = {
  courseId: string;
  /** Lecciones que tiene el curso de verdad (contadas con service role). */
  lessonCount: number;
  /** Lecciones que este usuario tiene marcadas como completadas. */
  completedCount: number;
  /** Ya hay fila en `course_completions`: se enlaza al documento directamente. */
  alreadyIssued: boolean;
  /** `profiles.full_name`, si lo hay, para prerrellenar el campo. */
  defaultName: string;
};

/**
 * Acceso al certificado de aprovechamiento, en el héroe de la ficha del curso.
 *
 * Mientras falten lecciones el botón está deshabilitado y dice cuántas quedan.
 * Ese bloqueo es sólo UX: `issueCompletion` vuelve a contar en el servidor, así
 * que forzar el click desde la consola no emite nada.
 */
export default function CompletionCertificateButton({
  courseId,
  lessonCount,
  completedCount,
  alreadyIssued,
  defaultName,
}: Props) {
  const { t } = useLanguage();
  const c = t.certificate;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [askingName, setAskingName] = useState(false);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, lessonCount - completedCount);
  const unlocked = lessonCount > 0 && remaining === 0;
  const certificateHref = `/courses/${courseId}/certificado`;

  if (!unlocked) {
    return (
      <div className={styles.wrapper}>
        <button type="button" className={styles.button} disabled aria-disabled="true">
          <Award size={16} aria-hidden="true" />
          {c.buttonLocked}
        </button>
        <p className={styles.hint}>
          {remaining === 1 ? c.remainingOne : c.remaining.replace('{n}', String(remaining))}
        </p>
      </div>
    );
  }

  if (alreadyIssued) {
    return (
      <div className={styles.wrapper}>
        <Link href={certificateHref} className={`${styles.button} ${styles.buttonReady}`}>
          <Award size={16} aria-hidden="true" />
          {c.view}
        </Link>
      </div>
    );
  }

  function submit() {
    // Mismo saneado que el servidor, para avisar antes de la ida y vuelta.
    const clean = normalizeRecipientName(name);
    if (!clean) {
      setError(c.errorInvalidName);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await issueCompletion(courseId, clean);
      if (result.ok) {
        router.push(certificateHref);
        return;
      }
      setError(
        result.error === 'invalid_name' ? c.errorInvalidName
          : result.error === 'incomplete' ? c.errorIncomplete
          : c.errorGeneric,
      );
    });
  }

  if (!askingName) {
    return (
      <div className={styles.wrapper}>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonReady}`}
          onClick={() => setAskingName(true)}
        >
          <Award size={16} aria-hidden="true" />
          {c.buttonReady}
        </button>
      </div>
    );
  }

  return (
    <form
      className={styles.nameForm}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <label className={styles.nameLabel} htmlFor="certificate-name">
        {c.namePrompt}
      </label>
      <input
        id="certificate-name"
        name="recipientName"
        className={styles.nameInput}
        type="text"
        value={name}
        maxLength={80}
        autoComplete="name"
        placeholder={c.namePlaceholder}
        aria-label={c.nameLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'certificate-name-error' : 'certificate-name-help'}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <p id="certificate-name-help" className={styles.hint}>{c.nameHelp}</p>
      {error && (
        <p id="certificate-name-error" className={styles.error} role="alert">{error}</p>
      )}
      <div className={styles.nameActions}>
        <button
          type="submit"
          className={`${styles.button} ${styles.buttonReady}`}
          disabled={isPending}
        >
          {isPending ? c.issuing : c.issue}
        </button>
        <button
          type="button"
          className={styles.buttonGhost}
          onClick={() => { setAskingName(false); setError(null); }}
          disabled={isPending}
        >
          {c.cancel}
        </button>
      </div>
    </form>
  );
}
