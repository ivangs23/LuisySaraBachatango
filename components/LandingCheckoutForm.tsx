'use client';

import { landingCheckout } from '@/app/curso-bachatango/comprar/actions';
import styles from '@/app/curso-bachatango/comprar/comprar.module.css';

interface Props { courseId: string; defaultEmail: string; defaultName: string; error?: string }

export default function LandingCheckoutForm({ courseId, defaultEmail, defaultName, error }: Props) {
  return (
    <form action={landingCheckout} className={styles.form}>
      <input type="hidden" name="courseId" value={courseId} />
      {error && <p className={styles.error}>Revisa tus datos e inténtalo de nuevo.</p>}
      <label className={styles.label} htmlFor="lc-name">Nombre</label>
      <input id="lc-name" name="fullName" type="text" required defaultValue={defaultName} className={styles.input} />
      <label className={styles.label} htmlFor="lc-email">Email</label>
      <input id="lc-email" name="email" type="email" required defaultValue={defaultEmail} placeholder="tu@email.com" className={styles.input} />
      <button type="submit" className={styles.button}>Continuar al pago</button>
      <p className={styles.note}>Te crearemos el acceso con estos datos y te enviaremos un email.</p>
    </form>
  );
}
