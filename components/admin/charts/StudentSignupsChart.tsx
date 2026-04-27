'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import ChartShell from './ChartShell'
import type { CountMonthRow } from '@/utils/admin/queries'

export default function StudentSignupsChart({ data }: { data: CountMonthRow[] }) {
  return (
    <ChartShell title="Altas de alumnos" sub="Por mes" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="rgba(var(--primary-rgb), 0.85)" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
