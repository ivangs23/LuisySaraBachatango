import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/supabase/get-user'
import EventsClient, { type EventRow } from '@/components/EventsClient'

// ISR: regenerate this page at most every 60s. Admin mutation actions in
// app/events/actions.ts call revalidatePath('/events') to force immediate
// invalidation on create/update/delete.
export const revalidate = 60

export default async function EventsPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  // Auth — non-throwing admin check (page is public)
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
