import { notFound } from 'next/navigation'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import StudentSummaryCard from '@/components/admin/StudentDetail/StudentSummaryCard'
import StudentTabs from '@/components/admin/StudentDetail/StudentTabs'
import TabCursos from '@/components/admin/StudentDetail/TabCursos'
import TabProgreso from '@/components/admin/StudentDetail/TabProgreso'
import TabEntregas from '@/components/admin/StudentDetail/TabEntregas'
import TabComunidad from '@/components/admin/StudentDetail/TabComunidad'
import TabPagos from '@/components/admin/StudentDetail/TabPagos'
import { getStudentDetail } from '@/utils/admin/queries'
import styles from '@/components/admin/StudentDetail/StudentDetail.module.css'

export const dynamic = 'force-dynamic'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sb = createSupabaseAdmin()
  const [data, coursesRes] = await Promise.all([
    getStudentDetail(id),
    sb.from('courses').select('id, title').eq('is_published', true).order('title'),
  ])
  if (!data) notFound()
  const courses = (coursesRes.data ?? []).map(c => ({ id: c.id as string, title: c.title as string }))

  return (
    <div className={styles.page}>
      <StudentSummaryCard data={data} courses={courses} />
      <main className={styles.tabsPane}>
        <StudentTabs
          tabs={[
            { key: 'cursos', label: 'Cursos', content: <TabCursos data={data} /> },
            { key: 'progreso', label: 'Progreso', content: <TabProgreso data={data} /> },
            { key: 'entregas', label: 'Entregas', content: <TabEntregas data={data} /> },
            { key: 'comunidad', label: 'Comunidad', content: <TabComunidad data={data} /> },
            { key: 'pagos', label: 'Pagos', content: <TabPagos data={data} /> },
          ]}
        />
      </main>
    </div>
  )
}
