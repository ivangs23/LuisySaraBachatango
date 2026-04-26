import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { deleteAccount, verifyStripeSession } from './actions'
import ProfileView from '@/components/ProfileView'
import { getDict } from '@/utils/get-dict'

export default async function ProfilePage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const sessionId = searchParams.session_id as string | undefined
  const t = await getDict()

  // If session_id is present, verify payment first
  if (sessionId) {
    const result = await verifyStripeSession(sessionId)
    console.log('Verification Result:', result)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // All independent queries in parallel.
  const [
    { data: profile },
    { data: subscriptions },
    { count: coursesPurchasedCount },
    { count: lessonsCompletedCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('subscriptions')
      .select('id, status, current_period_start, current_period_end')
      .eq('user_id', user.id)
      .order('current_period_end', { ascending: false })
      .limit(1),
    supabase
      .from('course_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('lesson_progress')
      .select('lesson_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_completed', true),
  ])

  const subscription = subscriptions?.[0] ?? null
  const isAdmin = profile?.role === 'admin'

  return (
    <ProfileView
      profile={{
        id: user.id,
        email: profile?.email ?? user.email ?? null,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        instagram: profile?.instagram ?? null,
        facebook: profile?.facebook ?? null,
        tiktok: profile?.tiktok ?? null,
        youtube: profile?.youtube ?? null,
        role: profile?.role ?? 'member',
      }}
      userEmail={user.email ?? ''}
      memberSince={user.created_at ?? null}
      subscription={subscription}
      coursesPurchasedCount={coursesPurchasedCount ?? 0}
      lessonsCompletedCount={lessonsCompletedCount ?? 0}
      isAdmin={isAdmin}
      t={t.profile}
      deleteAccountAction={deleteAccount}
    />
  )
}
