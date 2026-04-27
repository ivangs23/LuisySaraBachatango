import type { ReactNode } from 'react'
import styles from './charts.module.css'

export default function ChartShell({
  title, sub, children, isEmpty,
}: {
  title: string; sub?: string; children: ReactNode; isEmpty?: boolean
}) {
  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {sub && <p className={styles.sub}>{sub}</p>}
      </header>
      <div className={styles.chartWrap}>
        {isEmpty
          ? <p className={styles.empty}>Sin datos en este rango.</p>
          : children}
      </div>
    </div>
  )
}
