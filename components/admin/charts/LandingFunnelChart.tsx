'use client'

import ChartShell from './ChartShell'
import type { FunnelStep } from '@/utils/admin/landing-queries'
import styles from './charts.module.css'

const nf = new Intl.NumberFormat('es-ES')
const pf = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function LandingFunnelChart({ data }: { data: FunnelStep[] }) {
  // La referencia es el paso con MÁS visitas, no el primero: con los anuncios
  // entra más gente directa a la landing que por la home, y medir sobre la
  // home daba barras del 183 % que se salían de la tarjeta.
  const top = data.reduce<FunnelStep | null>((max, s) => (!max || s.visitors > max.visitors ? s : max), null)
  const topVisitors = top?.visitors ?? 0
  const isEmpty = data.every((s) => s.visitors === 0)
  const last = data[data.length - 1]
  const conversion = top && topVisitors > 0 ? (last.visitors / topVisitors) * 100 : null

  return (
    <ChartShell
      title="Embudo de venta"
      sub={conversion === null ? undefined : `Conversión total ${pf.format(conversion)} % (compras / ${top!.label})`}
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
              data-funnel-bar
              className={styles.funnelBar}
              style={{ width: topVisitors > 0 ? `${Math.max((step.visitors / topVisitors) * 100, 1)}%` : '1%' }}
            />
            {step.dropFromPrev !== null && (
              <span className={styles.funnelDrop}>
                {/* Más del 100 % no es «pasa desde el paso anterior»: es gente
                    que entra directa a este paso (un anuncio, un enlace). */}
                {step.dropFromPrev > 100
                  ? '↑ Hay más que en el paso anterior: entradas directas'
                  : `↓ ${pf.format(step.dropFromPrev)} % pasa desde el paso anterior`}
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
