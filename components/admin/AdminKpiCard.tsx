import type { LucideIcon } from 'lucide-react'
import styles from './AdminKpiCard.module.css'

type Props = {
  label: string
  value: string
  sub?: string
  Icon: LucideIcon
  trend?: 'up' | 'down' | null
}

export default function AdminKpiCard({ label, value, sub, Icon, trend }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.icon} aria-hidden>
          <Icon size={14} strokeWidth={2.2} />
        </span>
      </div>
      <div className={styles.value}>{value}</div>
      {sub ? (
        <p data-slot="sub" className={`${styles.sub} ${trend ? styles[trend] : ''}`}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}
