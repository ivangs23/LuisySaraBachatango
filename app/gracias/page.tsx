import type { Metadata } from 'next';
import { stripe } from '@/utils/stripe/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { isDemoMode } from '@/utils/demo/mode';
import styles from './gracias.module.css';

export const metadata: Metadata = {
  title: 'Gracias por tu compra',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function GraciasPage(props: { searchParams: Promise<{ session_id?: string; demo?: string; email?: string }> }) {
  const { session_id, demo, email: demoEmail } = await props.searchParams;

  // ── Rama demo: pago simulado, sin Stripe. Muestra el link para fijar
  // contraseña (así se prueba el flujo sin depender del email SMTP). Solo en
  // modo demo (en prod isDemoMode() es false y esta rama nunca se ejecuta).
  if (isDemoMode() && demo === '1' && demoEmail) {
    // Solo generamos/mostramos el link de recovery si coincide con el email de la
    // sesión autenticada actual. Sin este guard, cualquiera podría pasar ?email=
    // de OTRO usuario por la URL y recibir un link de recovery válido para su
    // cuenta (account takeover) en una BD compartida.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const sameUser = !!user?.email && user.email.toLowerCase() === demoEmail.toLowerCase();

    let setPasswordLink: string | null = null;
    if (sameUser) {
      try {
        const admin = createSupabaseAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        const { data } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email: demoEmail,
          options: { redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/auth/callback?next=/reset-password` },
        });
        setPasswordLink = data?.properties?.action_link ?? null;
      } catch {
        // generateLink falló → la compra ya está registrada; mostramos aviso sin link.
      }
    }
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <h1 className={styles.title}>MODO DEMO · pago simulado ✅</h1>
          <p className={styles.body}>Acceso creado para <strong>{demoEmail}</strong>.</p>
          {setPasswordLink
            ? <p className={styles.hint}>Fija tu contraseña aquí: <a className={styles.link} href={setPasswordLink}>fijar contraseña</a></p>
            : <p className={styles.hint}>Cuenta creada; revisa tu email para fijar la contraseña.</p>}
          <a href="/curso-bachatango" className={styles.link}>Volver</a>
        </div>
      </div>
    );
  }

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
