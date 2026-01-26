import SubscribeButton from '@/components/SubscribeButton';
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import styles from './profile.module.css'
import { updateProfile, deleteAccount } from './actions'
import ProfileForm from '@/components/ProfileForm';

import { verifyStripeSession } from './actions'

export default async function ProfilePage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams;
  const sessionId = searchParams.session_id as string | undefined;

  // If session_id is present, verify payment first
  if (sessionId) {
    const result = await verifyStripeSession(sessionId);
    console.log('Verification Result:', result);
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch subscription status
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .single()

  const isActive = !!subscription;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Mi Perfil</h1>
      
      <div className={styles.grid}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Editar Perfil</h2>
          <ProfileForm profile={profile} />
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Información de Cuenta</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.label}>Email</span>
              <span className={styles.value}>{user.email}</span>
            </div>

          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Suscripción</h2>
        <div className={styles.subscriptionCard}>
          <p className={styles.status}>
            Estado: <span className={isActive ? styles.active : styles.inactive}>
              {isActive ? 'Activo' : 'Inactivo'}
            </span>
          </p>
          
          {isActive ? (
            <p className={styles.description}>
              Tu suscripción está activa hasta el {new Date(subscription.current_period_end).toLocaleDateString()}.
            </p>
          ) : (
            <>
              <p className={styles.description}>No tienes una suscripción activa actualmente.</p>
              <SubscribeButton />
            </>
          )}
        </div>
      </div>

      <div className={styles.dangerZone}>
        <h2 className={styles.dangerTitle}>Zona de Peligro</h2>
        <p>Estas acciones no se pueden deshacer.</p>
        <div className={styles.actions}>
          <form action="/auth/signout" method="post">
            <button className={styles.logoutButton} type="submit">
              Cerrar Sesión
            </button>
          </form>
          
          <form action={deleteAccount}>
             <button className={styles.deleteButton} type="submit">
              Eliminar Cuenta
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
