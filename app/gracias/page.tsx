import type { Metadata } from 'next';
import { stripe } from '@/utils/stripe/server';
import styles from './gracias.module.css';

export const metadata: Metadata = {
  title: 'Gracias por tu compra',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function GraciasPage(props: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await props.searchParams;

  let email: string | null = null;
  let paid = false;
  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      paid = session.payment_status === 'paid';
      email = session.customer_details?.email ?? null;
    } catch {
      // sesión inválida/expirada → mensaje neutro
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {paid ? (
          <>
            <h1 className={styles.title}>¡Pago recibido! 🎉</h1>
            <p className={styles.body}>
              {email
                ? <>Te hemos enviado un email a <strong>{email}</strong> para crear tu acceso al curso.</>
                : <>Te hemos enviado un email para crear tu acceso al curso.</>}
            </p>
            <p className={styles.hint}>Revisa tu bandeja de entrada (y la carpeta de spam). Pulsa el enlace para fijar tu contraseña y entrar.</p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Gracias</h1>
            <p className={styles.body}>Si has completado un pago, en breve recibirás un email con tu acceso.</p>
            <p className={styles.hint}>¿Algún problema? Escríbenos desde la página de contacto.</p>
          </>
        )}
        <a href="/curso-bachatango" className={styles.link}>Volver</a>
      </div>
    </div>
  );
}
