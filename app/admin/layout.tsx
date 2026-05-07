import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAdmin, AdminGuardError } from '@/utils/auth/require-admin'
import { createClient } from '@/utils/supabase/server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import styles from './layout.module.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AdminGuardError) {
      if (e.reason === 'unauthenticated') redirect('/login')
      redirect('/dashboard')
    }
    throw e
  }

  const supabase = await createClient()
  const { count } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <div className={styles.shell}>
      <AdminSidebar pendingSubmissions={count ?? 0} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
