'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import FormPrivacyNotice from './FormPrivacyNotice';
import { useConsent } from '@/context/ConsentContext';
import { requestFreeClasses, type FreeClassesError } from '@/app/actions/free-classes';
import type { LandingCopy } from '@/app/curso-bachatango/copy';
import styles from './FreeClassesForm.module.css';

/** Ancla del formulario: la usa el enlace «Clase gratis por email» de la barra fija. */
export const FREE_CLASSES_ANCHOR = 'clases-por-email';

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={styles.button}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * «¿Te ha gustado? Te mandamos dos clases más», justo debajo de la clase
 * gratis de la landing. Captura a quien no compra en la primera visita.
 *
 * La casilla de consentimiento es obligatoria y nace desmarcada: el alta es
 * para recibir emails comerciales (LSSI art. 21, RGPD considerando 32). La
 * acción lo vuelve a comprobar en servidor.
 */
export default function FreeClassesForm({ copy }: { copy: LandingCopy['freeEmail'] }) {
  const { state, hydrated } = useConsent();
  const [status, setStatus] = useState<'idle' | 'ok' | FreeClassesError>('idle');

  async function enviar(formData: FormData) {
    const r = await requestFreeClasses(formData);
    if ('error' in r) {
      setStatus(r.error);
      return;
    }
    setStatus('ok');

    // Lead del píxel con el mismo event_id que manda el servidor por la API de
    // conversiones: Meta se queda con uno. Solo con consentimiento de
    // marketing; sin él, `fbq` ni siquiera se ha cargado.
    if (!hydrated || !state?.marketing || typeof window.fbq !== 'function') return;
    try {
      window.fbq('track', 'Lead', { content_name: 'Clases gratis por email' }, { eventID: r.eventId });
    } catch {
      // La medición nunca puede estropear la confirmación.
    }
  }

  return (
    <div id={FREE_CLASSES_ANCHOR} className={styles.wrap}>
      <h3 className={styles.title}>{copy.title}</h3>
      {status === 'ok' ? (
        <p role="status" className={styles.success}>{copy.success}</p>
      ) : (
        <form action={enviar} className={styles.form}>
          <p className={styles.body}>{copy.body}</p>
          <label htmlFor="free-classes-email" className={styles.label}>{copy.emailLabel}</label>
          <div className={styles.row}>
            <input
              id="free-classes-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder={copy.placeholder}
              className={styles.input}
            />
            <SubmitButton label={copy.cta} pendingLabel={copy.sending} />
          </div>
          <label className={styles.consent}>
            <input type="checkbox" name="consent" required />
            <span>{copy.consent}</span>
          </label>
          {status !== 'idle' && (
            <p role="alert" className={styles.error}>{copy.errors[status]}</p>
          )}
          <FormPrivacyNotice
            purpose="Enviarte las dos clases gratis y, después, emails con consejos y ofertas sobre nuestros cursos."
            legalBasis="Tu consentimiento (art. 6.1.a RGPD), que puedes retirar en cualquier momento desde el enlace de baja de cada correo."
          />
        </form>
      )}
    </div>
  );
}
