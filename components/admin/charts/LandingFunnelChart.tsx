'use client'

import ChartShell from './ChartShell'
import type { FunnelStep } from '@/utils/admin/landing-queries'
import styles from './charts.module.css'

const nf = new Intl.NumberFormat('es-ES')
const pf = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function LandingFunnelChart({ data }: { data: FunnelStep[] }) {
  const top = data[0]?.visitors ?? 0
  const isEmpty = data.every((s) => s.visitors === 0)
  const conversion = top > 0 ? (data[data.length - 1].visitors / top) * 100 : null

  return (
    <ChartShell
      title="Embudo de venta"
      sub={conversion === null ? undefined : `Conversión total ${pf.format(conversion)} %`}
      isEmpty={isEmpty}
    >
      <ol className={styles.funnel}>
        {data.map((step) => (
          <li key={step.path} className={styles.funnelStep}>
            <div className={styles.funnelHead}>
              <span className={styles.funnelLabel}>{step.label}</span>
              <span className={styles.funnelValue}>{nf.format(step.visitors)}</span>
            </div>
            <div
              className={styles.funnelBar}
              style={{ width: top > 0 ? `${Math.max((step.visitors / top) * 100, 1)}%` : '1%' }}
            />
            {step.dropFromPrev !== null && (
              <span className={styles.funnelDrop}>
                ↓ {pf.format(step.dropFromPrev)} % pasa desde el paso anterior
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className={styles.funnelNote}>
        Son proporciones entre pasos, no recorridos seguidos persona a persona:
        el identificador caduca cada día, así que quien visita un martes y compra
        el jueves cuenta en ambos pasos sin quedar enlazado.
      </p>
    </ChartShell>
  )
}
