import { redirect } from 'next/navigation'
import { requireAdmin, AdminGuardError } from '@/utils/auth/require-admin'
import EventForm from '@/components/EventForm'

export const dynamic = 'force-dynamic'

export default async function CreateEventPage() {
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AdminGuardError) {
      if (e.reason === 'unauthenticated') redirect('/login')
      redirect('/dashboard')
    }
    throw e
  }

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Crear evento</h1>
      <EventForm />
    </div>
  )
}
