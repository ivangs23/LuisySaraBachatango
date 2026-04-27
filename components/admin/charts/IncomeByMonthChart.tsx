'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import ChartShell from './ChartShell'
import type { IncomeMonthRow } from '@/utils/admin/queries'

export default function IncomeByMonthChart({ data }: { data: IncomeMonthRow[] }) {
  return (
    <ChartShell title="Ingresos por mes" sub="Suscripciones + compras de cursos" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={(v: number) => `€${Number(v).toFixed(0)}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="subscriptions" stackId="a" fill="rgba(var(--primary-rgb), 0.55)" name="Suscripciones" />
          <Bar dataKey="purchases" stackId="a" fill="rgba(var(--primary-rgb), 1)" name="Compras" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
