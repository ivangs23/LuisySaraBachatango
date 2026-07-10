'use client';

import { simulatePurchase } from '@/app/demo-checkout/actions';
import styles from '@/app/demo-checkout/demo-checkout.module.css';

interface Props {
  courseId: string;
  defaultEmail: string;
}

export default function DemoCheckoutForm({ courseId, defaultEmail }: Props) {
  return (
    <form action={simulatePurchase} className={styles.form}>
      <input type="hidden" name="courseId" value={courseId} />
      <label className={styles.label} htmlFor="demo-email">Email de prueba</label>
      <input
        id="demo-email"
        name="email"
        type="email"
        required
        defaultValue={defaultEmail}
        placeholder="tu@email.com"
        className={styles.input}
      />
      <button type="submit" className={styles.button}>Simular pago</button>
      <p className={styles.note}>Modo demo: no se cobra nada. Se crea el acceso al curso como si hubieras pagado.</p>
    </form>
  );
}
