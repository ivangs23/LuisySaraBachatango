import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import styles from './profile.module.css'
import { deleteAccount } from './actions'
import ProfileForm from '@/components/ProfileForm';
import { verifyStripeSession } from './actions'
import { getDict } from '@/utils/get-dict'

export default async function ProfilePage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams;
  const sessionId = searchParams.session_id as string | undefined;
  const t = await getDict();

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

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t.profile.title}</h1>

      <div className={styles.grid}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.profile.editProfile}</h2>
          <ProfileForm profile={profile} />
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.profile.accountInfo}</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.label}>{t.profile.email}</span>
              <span className={styles.value}>{user.email}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.dangerZone}>
        <h2 className={styles.dangerTitle}>{t.profile.dangerZone}</h2>
        <p>{t.profile.undoableWarning}</p>
        <div className={styles.actions}>
          <form action="/auth/signout" method="post">
            <button className={styles.logoutButton} type="submit">
              {t.profile.logout}
            </button>
          </form>

          <form action={deleteAccount}>
            <button className={styles.deleteButton} type="submit">
              {t.profile.deleteAccount}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
