import { createClient } from '@/utils/supabase/server'
import EventsClient, { type EventRow } from '@/components/EventsClient'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const supabase = await createClient()

  // Auth — non-throwing admin check (page is public)
  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = profile?.role === 'admin'
  }

  // RLS handles visibility (anon/non-admin only sees published).
  const { data: rows } = await supabase
    .from('events')
    .select('id, start_date, end_date, location, is_published, title, description')
    .order('start_date', { ascending: true })

  const events: EventRow[] = (rows ?? []) as EventRow[]
  return <EventsClient events={events} isAdmin={isAdmin} />
}
