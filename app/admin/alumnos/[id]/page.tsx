import { notFound } from 'next/navigation'
import StudentSummaryCard from '@/components/admin/StudentDetail/StudentSummaryCard'
import { getStudentDetail } from '@/utils/admin/queries'
import styles from '@/components/admin/StudentDetail/StudentDetail.module.css'

export const dynamic = 'force-dynamic'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getStudentDetail(id)
  if (!data) notFound()

  return (
    <div className={styles.page}>
      <StudentSummaryCard data={data} />
      <main className={styles.tabsPane}>
        {/* Tabs added in next task */}
        <p>Datos cargados — pestañas en construcción.</p>
      </main>
    </div>
  )
}
