import RangePicker from '@/components/admin/charts/RangePicker'
import IncomeByMonthChart from '@/components/admin/charts/IncomeByMonthChart'
import StudentSignupsChart from '@/components/admin/charts/StudentSignupsChart'
import ActiveSubsChart from '@/components/admin/charts/ActiveSubsChart'
import TopCoursesChart from '@/components/admin/charts/TopCoursesChart'
import PlanDistributionChart from '@/components/admin/charts/PlanDistributionChart'
import EngagementChart from '@/components/admin/charts/EngagementChart'
import {
  getStatsIncomeByMonth, getStatsSignupsByMonth, getStatsActiveSubsTimeseries,
  getStatsTopCourses, getStatsPlanDistribution, getStatsEngagement,
  type Range,
} from '@/utils/admin/queries'
import styles from './estadisticas.module.css'

export const dynamic = 'force-dynamic'

function parseRange(raw: string | undefined): Range {
  if (raw === '30') return 30
  if (raw === '365') return 365
  if (raw === 'all') return 'all'
  return 90
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const sp = await searchParams
  const range = parseRange(sp.range)
  const rangeKey = sp.range && ['30', '90', '365', 'all'].includes(sp.range) ? sp.range : '90'

  const [income, signups, activeSubs, topCourses, plans, engagement] = await Promise.all([
    getStatsIncomeByMonth(range),
    getStatsSignupsByMonth(range),
    getStatsActiveSubsTimeseries(range),
    getStatsTopCourses(),
    getStatsPlanDistribution(),
    getStatsEngagement(range),
  ])

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Estadísticas</h1>
        <RangePicker value={rangeKey} />
      </header>

      <div className={styles.grid}>
        <div className={styles.full}><IncomeByMonthChart data={income} /></div>
        <div className={styles.full}><StudentSignupsChart data={signups} /></div>
        <div className={styles.full}><ActiveSubsChart data={activeSubs} /></div>
        <div className={styles.half}><TopCoursesChart data={topCourses} /></div>
        <div className={styles.half}><PlanDistributionChart data={plans} /></div>
        <div className={styles.full}><EngagementChart data={engagement} /></div>
      </div>
    </div>
  )
}
