import { PlayCircle } from 'lucide-react'
import AdminKpiCard from './AdminKpiCard'
import type { FreeClassPlays } from '@/utils/admin/landing-queries'

const nf = new Intl.NumberFormat('es-ES')
const pf = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/**
 * Únicos que dieron al play en la clase gratis de la landing, y qué parte son
 * de quienes vieron la landing. Lo mide `LandingFreeClass` con un evento por
 * carga (ver FREE_CLASS_PLAY_PATH en utils/analytics/tracked-paths.ts).
 */
export default function FreeClassPlaysCard({ data }: { data: FreeClassPlays }) {
  const sub =
    data.rate === null
      ? 'Sin visitas a la landing en este rango'
      : `${pf.format(data.rate)} % de quienes vieron la landing (${nf.format(data.viewers)} de ${nf.format(data.landingVisitors)})`

  return (
    <AdminKpiCard
      Icon={PlayCircle}
      label="Reproducciones de la clase gratis"
      value={nf.format(data.viewers)}
      sub={sub}
    />
  )
}
