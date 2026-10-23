import type { LucideIcon } from 'lucide-react'
import AdminKpiCard from './AdminKpiCard'
import type { LandingEventRate } from '@/utils/admin/landing-queries'

const nf = new Intl.NumberFormat('es-ES')
const pf = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/**
 * Un evento de la landing frente a las visitas a la landing: reproducciones
 * de la clase gratis, emails capturados. Únicos por día, como el embudo.
 */
export default function LandingRateCard({
  label, Icon, data,
}: { label: string; Icon: LucideIcon; data: LandingEventRate }) {
  const sub =
    data.rate === null
      ? 'Sin visitas a la landing en este rango'
      : `${pf.format(data.rate)} % de quienes vieron la landing (${nf.format(data.viewers)} de ${nf.format(data.landingVisitors)})`

  return <AdminKpiCard Icon={Icon} label={label} value={nf.format(data.viewers)} sub={sub} />
}
