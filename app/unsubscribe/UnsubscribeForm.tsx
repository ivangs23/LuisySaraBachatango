'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { unsubscribeByToken } from './actions';
import styles from './page.module.css';

export default function UnsubscribeForm({ email, token }: { email: string; token: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'ok' | 'invalid' | 'error'>('idle');

  // Baja por POST, nunca al abrir el enlace: los escáneres de enlaces de
  // Outlook y Gmail visitan las URLs de los emails automáticamente, y una
  // baja por GET se dispararía sola sin que nadie hiciera clic.
  function handle() {
    startTransition(async () => {
      const r = await unsubscribeByToken(email, token);
      if ('ok' in r) setStatus('ok');
      else setStatus(r.error === 'invalid' ? 'invalid' : 'error');
    });
  }

  if (status === 'ok') {
    return (
      <div>
        <p className={styles.success} role="status">
          Listo. No volverás a recibir nuestros emails.
        </p>
        <Link href="/" className={styles.link}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className={styles.button} onClick={handle} disabled={isPending}>
        {isPending ? 'Procesando...' : 'Confirmar baja'}
      </button>
      {status === 'invalid' && (
        <p className={styles.error} role="alert">
          El enlace no es válido o ha sido modificado. Escríbenos a{' '}
          <a href="mailto:luisysarabachatango@gmail.com">luisysarabachatango@gmail.com</a>{' '}
          y te damos de baja a mano.
        </p>
      )}
      {status === 'error' && (
        <p className={styles.error} role="alert">
          No hemos podido procesarlo. Inténtalo de nuevo en unos minutos.
        </p>
      )}
      <div>
        <Link href="/" className={styles.link}>Cancelar</Link>
      </div>
    </div>
  );
}
