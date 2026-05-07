import { notFound, redirect } from 'next/navigation'
import { requireAdmin, AdminGuardError } from '@/utils/auth/require-admin'
import { createClient } from '@/utils/supabase/server'
import EventForm from '@/components/EventForm'

export const dynamic = 'force-dynamic'

type Params = { id: string }

const EMPTY_LOCALIZED = { es: '', en: '', fr: '', de: '', it: '', ja: '' }

export default async function EditEventPage({ params }: { params: Promise<Params> }) {
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AdminGuardError) {
      if (e.reason === 'unauthenticated') redirect('/login')
      redirect('/dashboard')
    }
    throw e
  }

  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, start_date, end_date, location, is_published, title, description')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) notFound()

  const initialData = {
    id: data.id as string,
    start_date: data.start_date as string,
    end_date: data.end_date as string,
    location: data.location as string,
    is_published: data.is_published as boolean,
    title: { ...EMPTY_LOCALIZED, ...(data.title as Record<string, string>) },
    description: { ...EMPTY_LOCALIZED, ...(data.description as Record<string, string>) },
  }

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Editar evento</h1>
      <EventForm initialData={initialData} />
    </div>
  )
}
