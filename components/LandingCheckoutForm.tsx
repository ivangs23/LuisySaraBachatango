'use client';

import { useEffect, useRef } from 'react';
import FormPrivacyNotice from './FormPrivacyNotice';
import { useFormStatus } from 'react-dom';
import { landingCheckout } from '@/app/curso-bachatango/comprar/actions';
import styles from '@/app/curso-bachatango/comprar/comprar.module.css';

interface Props { courseId: string; defaultEmail: string; defaultName: string; error?: string }

const ERROR_MESSAGES: Record<string, string> = {
  invalid_name: 'Escribe tu nombre completo.',
  invalid_email: 'Revisa el correo: no parece válido.',
  age_required: 'Debes confirmar que tienes 16 años o más.',
  terms_required: 'Tienes que aceptar las condiciones para continuar.',
  digital_execution_required: 'Marca la casilla de acceso inmediato para continuar.',
  rate: 'Has hecho varios intentos seguidos. Espera un minuto y vuelve a probar.',
  stripe: 'No hemos podido abrir el pago. Inténtalo de nuevo en un momento.',
  course: 'Ese curso no está disponible ahora mismo.',
  account_creation_failed: 'No hemos podido preparar tu compra. Inténtalo de nuevo.',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={styles.button}>
      {pending ? 'Procesando…' : 'Continuar al pago'}
    </button>
  );
}

export default function LandingCheckoutForm({ courseId, defaultEmail, defaultName, error }: Props) {
  const message = error ? (ERROR_MESSAGES[error] ?? 'Revisa tus datos e inténtalo de nuevo.') : null;
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (message) errorRef.current?.focus();
  }, [message]);

  return (
    <form action={landingCheckout} className={styles.form}>
      <input type="hidden" name="courseId" value={courseId} />
      {message && (
        <p ref={errorRef} role="alert" tabIndex={-1} id="lc-form-error" className={styles.error}>
          {message}
        </p>
      )}

      <label className={styles.label} htmlFor="lc-name">Nombre completo</label>
      <input id="lc-name" name="fullName" type="text" required defaultValue={defaultName} className={styles.input} autoComplete="name" />

      <label className={styles.label} htmlFor="lc-email">Email</label>
      <input id="lc-email" name="email" type="email" required defaultValue={defaultEmail} placeholder="tu@email.com" className={styles.input} autoComplete="email" />

      <label className={styles.checkboxRow}>
        <input name="isAdult" type="checkbox" value="on" required />
        <span>Confirmo que tengo 16 años o más.</span>
      </label>

      <label className={styles.checkboxRow}>
        <input name="marketingConsent" type="checkbox" value="on" />
        <span>Quiero recibir novedades y ofertas por email.</span>
      </label>

      <label className={styles.checkboxRow}>
        <input name="acceptTerms" type="checkbox" value="on" required />
        <span>Acepto los <a href="/legal/terms" target="_blank" rel="noopener noreferrer">términos y condiciones</a> y la <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">política de privacidad</a>.</span>
      </label>

      {/*
        Casilla propia y obligatoria, separada de la de términos. El art. 103.m
        RDL 1/2007 solo excluye el desistimiento si el consumidor consintió
        expresamente el inicio inmediato de la ejecución Y reconoció que con
        ello pierde el derecho: son dos declaraciones sobre este punto
        concreto, y una casilla genérica de "acepto los términos" no las
        acredita. La fecha de aceptación se guarda como evidencia.
      */}
      <label className={styles.checkboxRow}>
        <input name="acceptDigitalExecution" type="checkbox" value="on" required />
        <span>
          Solicito el acceso inmediato al curso y reconozco que, al comenzar la
          ejecución, pierdo mi derecho de desistimiento de 14 días (art. 103.m
          RDL 1/2007).
        </span>
      </label>

      <FormPrivacyNotice
        purpose="Crear y gestionar tu cuenta de alumno, procesar el pago, darte acceso al curso y emitir la factura."
        legalBasis="La ejecución del contrato de compraventa (art. 6.1.b RGPD) y, para la facturación, una obligación legal (art. 6.1.c RGPD)."
      />

      <SubmitButton />
      <p className={styles.note}>Creamos tu cuenta al confirmarse el pago. No se cobra nada hasta entonces.</p>
    </form>
  );
}
