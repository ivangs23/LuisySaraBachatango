'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { landingCheckout } from '@/app/curso-bachatango/comprar/actions';
import { COUNTRIES } from '@/utils/i18n/countries';
import styles from '@/app/curso-bachatango/comprar/comprar.module.css';

interface Defaults {
  country?: string;
  city?: string;
  postalCode?: string;
  dateOfBirth?: string;
  danceLevel?: string;
  phone?: string;
}

interface Props { courseId: string; defaultEmail: string; defaultName: string; error?: string; defaults?: Defaults }

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'Rellena todos los campos obligatorios.',
  invalid_email: 'El email no es válido.',
  password_too_short: 'La contraseña debe tener al menos 8 caracteres.',
  password_weak: 'La contraseña debe incluir mayúscula, minúscula y número.',
  password_mismatch: 'Las contraseñas no coinciden.',
  invalid_country: 'Selecciona un país válido.',
  invalid_postal: 'Introduce un código postal válido.',
  invalid_birthdate: 'Introduce una fecha de nacimiento válida (edad 16–100).',
  invalid_phone: 'El teléfono no es válido.',
  terms_not_accepted: 'Debes aceptar los términos y la privacidad.',
  account_creation_failed: 'No pudimos procesar tu registro. Inténtalo de nuevo.',
  rate: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  stripe: 'No pudimos iniciar el pago. Inténtalo de nuevo.',
  course: 'Este curso no está disponible.',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={styles.button}>
      {pending ? 'Procesando…' : 'Continuar al pago'}
    </button>
  );
}

export default function LandingCheckoutForm({ courseId, defaultEmail, defaultName, error, defaults }: Props) {
  const message = error ? (ERROR_MESSAGES[error] ?? 'Revisa tus datos e inténtalo de nuevo.') : null;
  const errorRef = useRef<HTMLParagraphElement>(null);
  const todayISO = new Date().toISOString().slice(0, 10);

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

      <label className={styles.label} htmlFor="lc-password">Contraseña</label>
      <input id="lc-password" name="password" type="password" required minLength={8} className={styles.input} autoComplete="new-password" placeholder="Mín. 8, con mayúscula, minúscula y número" aria-describedby="lc-password-hint" />
      <span id="lc-password-hint" className={styles.note}>Mín. 8 caracteres, con mayúscula, minúscula y número.</span>

      <label className={styles.label} htmlFor="lc-password2">Repetir contraseña</label>
      <input id="lc-password2" name="repeatPassword" type="password" required minLength={8} className={styles.input} autoComplete="new-password" />

      <label className={styles.label} htmlFor="lc-country">País</label>
      <select id="lc-country" name="country" required defaultValue={defaults?.country ?? ''} className={styles.input} autoComplete="country">
        <option value="" disabled>Selecciona tu país</option>
        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>

      <label className={styles.label} htmlFor="lc-city">Ciudad</label>
      <input id="lc-city" name="city" type="text" required defaultValue={defaults?.city ?? ''} className={styles.input} autoComplete="address-level2" />

      <label className={styles.label} htmlFor="lc-postal">Código postal</label>
      <input id="lc-postal" name="postalCode" type="text" required defaultValue={defaults?.postalCode ?? ''} className={styles.input} autoComplete="postal-code" placeholder="28001" />

      <label className={styles.label} htmlFor="lc-dob">Fecha de nacimiento</label>
      <input id="lc-dob" name="dateOfBirth" type="date" required defaultValue={defaults?.dateOfBirth ?? ''} max={todayISO} className={styles.input} autoComplete="bday" />

      <label className={styles.label} htmlFor="lc-level">Nivel de baile</label>
      <select id="lc-level" name="danceLevel" required defaultValue={defaults?.danceLevel ?? ''} className={styles.input}>
        <option value="" disabled>Selecciona tu nivel</option>
        <option value="principiante">Principiante</option>
        <option value="intermedio">Intermedio</option>
        <option value="avanzado">Avanzado</option>
      </select>

      <label className={styles.label} htmlFor="lc-phone">Teléfono (WhatsApp) · opcional</label>
      <input id="lc-phone" name="phone" type="tel" defaultValue={defaults?.phone ?? ''} className={styles.input} autoComplete="tel" placeholder="+34 600 123 456" />

      <label className={styles.checkboxRow}>
        <input name="marketingConsent" type="checkbox" value="on" />
        <span>Quiero recibir novedades y ofertas por email.</span>
      </label>

      <label className={styles.checkboxRow}>
        <input name="acceptTerms" type="checkbox" value="on" required />
        <span>Acepto los <a href="/legal/terms" target="_blank" rel="noopener noreferrer">términos</a> y la <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">privacidad</a>.</span>
      </label>

      <SubmitButton />
      <p className={styles.note}>Creamos tu cuenta al confirmarse el pago. No se cobra nada hasta entonces.</p>
    </form>
  );
}
