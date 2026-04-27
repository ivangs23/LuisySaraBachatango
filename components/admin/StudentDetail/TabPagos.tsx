import type { StudentDetail } from '@/utils/admin/queries'
import { centsToEur } from '@/utils/admin/metrics'
import styles from './StudentDetail.module.css'

const PLAN_LABEL: Record<string, string> = { '1month': 'Mensual', '6months': '6 meses', '1year': 'Anual' }

export default function TabPagos({ data }: { data: StudentDetail }) {
  type Row = { date: string; concept: string; amount: number }
  const rows: Row[] = [
    ...data.purchases.map(p => ({
      date: p.created_at,
      concept: `Compra · ${p.course_title}`,
      amount: centsToEur(p.amount_paid),
    })),
  ]

  if (data.subscription?.current_period_start && data.subscription.plan_type) {
    rows.push({
      date: data.subscription.current_period_start,
      concept: `Suscripción · ${PLAN_LABEL[data.subscription.plan_type] ?? data.subscription.plan_type}`,
      amount: 0,
    })
  }

  rows.sort((a, b) => b.date.localeCompare(a.date))
  const total = rows.reduce((s, r) => s + r.amount, 0)

  if (rows.length === 0) return <p className={styles.dim}>Sin pagos registrados.</p>

  return (
    <table className={styles.subItemTable}>
      <thead><tr><th>Fecha</th><th>Concepto</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{new Date(r.date).toLocaleDateString('es-ES')}</td>
            <td>{r.concept}</td>
            <td style={{ textAlign: 'right' }}>{r.amount > 0 ? `€${r.amount.toFixed(0)}` : '—'}</td>
          </tr>
        ))}
        <tr className={styles.totalRow}>
          <td colSpan={2}>Total compras</td>
          <td style={{ textAlign: 'right' }}>€{total.toFixed(0)}</td>
        </tr>
      </tbody>
    </table>
  )
}
