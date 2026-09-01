import type { Metadata } from 'next';
import Link from 'next/link';
import UnsubscribeForm from './UnsubscribeForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Darse de baja',
  robots: { index: false, follow: false },
};

// Copy en español fijo, sin diccionario: se llega aquí desde un email en
// español y la página no tiene otra entrada.
export default async function UnsubscribePage(
  props: { searchParams: Promise<{ email?: string; token?: string }> },
) {
  const { email, token } = await props.searchParams;

  if (!email || !token) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Enlace no válido</h1>
        <p className={styles.body}>
          Este enlace de baja está incompleto. Escríbenos a{' '}
          <a href="mailto:luisysarabachatango@gmail.com">luisysarabachatango@gmail.com</a>{' '}
          y te damos de baja a mano.
        </p>
        <Link href="/" className={styles.link}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>¿Darte de baja?</h1>
      <p className={styles.body}>
        Dejarás de recibir nuestros emails en <strong>{email}</strong>.
        Podrás volver a suscribirte cuando quieras desde la web.
      </p>
      <UnsubscribeForm email={email} token={token} />
    </div>
  );
}
