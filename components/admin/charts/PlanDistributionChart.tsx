'use client'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import ChartShell from './ChartShell'
import type { PlanSlice } from '@/utils/admin/queries'

const COLORS = [
  'rgba(var(--primary-rgb), 1)',
  'rgba(var(--primary-rgb), 0.6)',
  'rgba(var(--primary-rgb), 0.35)',
  'rgba(var(--primary-rgb), 0.18)',
]

const PLAN_LABELS: Record<string, string> = { '1month': 'Mensual', '6months': '6 meses', '1year': 'Anual' }

export default function PlanDistributionChart({ data }: { data: PlanSlice[] }) {
  const formatted = data.map(d => ({ name: PLAN_LABELS[d.plan] ?? d.plan, value: d.count }))
  return (
    <ChartShell title="Distribución de planes" sub="Suscripciones activas" isEmpty={formatted.length === 0}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={formatted} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
            {formatted.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
