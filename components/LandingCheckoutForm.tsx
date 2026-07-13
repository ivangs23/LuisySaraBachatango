'use client';

import { landingCheckout } from '@/app/curso-bachatango/comprar/actions';
import { COUNTRIES } from '@/utils/i18n/countries';
import styles from '@/app/curso-bachatango/comprar/comprar.module.css';

interface Props { courseId: string; defaultEmail: string; defaultName: string; error?: string }

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'Rellena todos los campos obligatorios.',
  invalid_email: 'El email no es válido.',
  password_too_short: 'La contraseña debe tener al menos 8 caracteres.',
  password_weak: 'La contraseña debe incluir mayúscula, minúscula y número.',
  password_mismatch: 'Las contraseñas no coinciden.',
  invalid_country: 'Selecciona un país válido.',
  invalid_birthdate: 'Introduce una fecha de nacimiento válida (edad 16–100).',
  invalid_phone: 'El teléfono no es válido.',
  terms_not_accepted: 'Debes aceptar los términos y la privacidad.',
  account_creation_failed: 'No pudimos procesar tu registro. Inténtalo de nuevo.',
  rate: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  stripe: 'No pudimos iniciar el pago. Inténtalo de nuevo.',
  course: 'Este curso no está disponible.',
};

export default function LandingCheckoutForm({ courseId, defaultEmail, defaultName, error }: Props) {
  const message = error ? (ERROR_MESSAGES[error] ?? 'Revisa tus datos e inténtalo de nuevo.') : null;
  return (
    <form action={landingCheckout} className={styles.form}>
      <input type="hidden" name="courseId" value={courseId} />
      {message && <p className={styles.error}>{message}</p>}

      <label className={styles.label} htmlFor="lc-name">Nombre completo</label>
      <input id="lc-name" name="fullName" type="text" required defaultValue={defaultName} className={styles.input} autoComplete="name" />

      <label className={styles.label} htmlFor="lc-email">Email</label>
      <input id="lc-email" name="email" type="email" required defaultValue={defaultEmail} placeholder="tu@email.com" className={styles.input} autoComplete="email" />

      <label className={styles.label} htmlFor="lc-password">Contraseña</label>
      <input id="lc-password" name="password" type="password" required minLength={8} className={styles.input} autoComplete="new-password" placeholder="Mín. 8, con mayúscula, minúscula y número" />

      <label className={styles.label} htmlFor="lc-password2">Repetir contraseña</label>
      <input id="lc-password2" name="repeatPassword" type="password" required minLength={8} className={styles.input} autoComplete="new-password" />

      <label className={styles.label} htmlFor="lc-country">País</label>
      <select id="lc-country" name="country" required defaultValue="" className={styles.input}>
        <option value="" disabled>Selecciona tu país</option>
        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>

      <label className={styles.label} htmlFor="lc-city">Ciudad</label>
      <input id="lc-city" name="city" type="text" required className={styles.input} autoComplete="address-level2" />

      <label className={styles.label} htmlFor="lc-dob">Fecha de nacimiento</label>
      <input id="lc-dob" name="dateOfBirth" type="date" required className={styles.input} />

      <label className={styles.label} htmlFor="lc-level">Nivel de baile</label>
      <select id="lc-level" name="danceLevel" required defaultValue="" className={styles.input}>
        <option value="" disabled>Selecciona tu nivel</option>
        <option value="principiante">Principiante</option>
        <option value="intermedio">Intermedio</option>
        <option value="avanzado">Avanzado</option>
      </select>

      <label className={styles.label} htmlFor="lc-phone">Teléfono (WhatsApp) · opcional</label>
      <input id="lc-phone" name="phone" type="tel" className={styles.input} autoComplete="tel" placeholder="+34 600 123 456" />

      <label className={styles.checkboxRow}>
        <input name="marketingConsent" type="checkbox" value="on" />
        <span>Quiero recibir novedades y ofertas por email.</span>
      </label>

      <label className={styles.checkboxRow}>
        <input name="acceptTerms" type="checkbox" value="on" required />
        <span>Acepto los <a href="/legal/terms" target="_blank" rel="noopener noreferrer">términos</a> y la <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">privacidad</a>.</span>
      </label>

      <button type="submit" className={styles.button}>Continuar al pago</button>
      <p className={styles.note}>Creamos tu cuenta al confirmarse el pago. No se cobra nada hasta entonces.</p>
    </form>
  );
}
