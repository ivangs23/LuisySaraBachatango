import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/supabase/get-user'
import { safeJsonLd } from '@/utils/jsonld'
import EventsClient, { type EventRow } from '@/components/EventsClient'

export const metadata: Metadata = {
  title: 'Eventos y festivales | Luis y Sara Bachatango',
  description: 'Próximos eventos, festivales y workshops de Luis y Sara Bachatango.',
  openGraph: {
    title: 'Eventos | Luis y Sara Bachatango',
    description: 'Próximos eventos y festivales de Bachatango.',
    url: '/events',
    images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: 'Eventos Bachatango' }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: '/events' },
}

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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'

  const eventsJsonLd = events.map(e => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title?.es ?? e.title?.en ?? 'Evento',
    startDate: e.start_date,
    endDate: e.end_date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: e.location ?? '',
      address: e.location ?? '',
    },
    description: e.description?.es ?? e.description?.en ?? '',
    organizer: {
      '@type': 'Organization',
      name: 'Luis y Sara Bachatango',
      url: baseUrl,
    },
  }))

  return (
    <>
      {eventsJsonLd.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(eventsJsonLd) }}
        />
      )}
      <EventsClient events={events} isAdmin={isAdmin} />
    </>
  )
}
