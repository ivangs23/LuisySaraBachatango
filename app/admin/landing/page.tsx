import Link from 'next/link'
import RangePicker from '@/components/admin/charts/RangePicker'
import LandingFunnelChart from '@/components/admin/charts/LandingFunnelChart'
import LandingTrafficChart from '@/components/admin/charts/LandingTrafficChart'
import { getLandingFunnel, getLandingTraffic } from '@/utils/admin/landing-queries'
import type { Range } from '@/utils/admin/queries'
import styles from './landing.module.css'

export const dynamic = 'force-dynamic'

function parseRange(raw: string | undefined): Range {
  if (raw === '30') return 30
  if (raw === '365') return 365
  if (raw === 'all') return 'all'
  return 90
}

export default async function LandingStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const sp = await searchParams
  const range = parseRange(sp.range)
  const rangeKey = sp.range && ['30', '90', '365', 'all'].includes(sp.range) ? sp.range : '90'

  const [funnel, traffic] = await Promise.all([
    getLandingFunnel(range),
    getLandingTraffic(range),
  ])

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Landing</h1>
        <div className={styles.headerActions}>
          <Link href="/admin/landing/contenido" className={styles.navLink}>Editar contenido →</Link>
          <RangePicker value={rangeKey} />
        </div>
      </header>

      <p className={styles.intro}>
        Medición propia, sin cookies y sin datos personales. Empieza el día que
        se desplegó: no hay histórico anterior.
      </p>

      <div className={styles.grid}>
        <LandingFunnelChart data={funnel} />
        <LandingTrafficChart data={traffic} />
      </div>
    </div>
  )
}
