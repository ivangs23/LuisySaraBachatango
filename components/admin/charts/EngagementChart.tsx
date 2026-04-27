'use client'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import ChartShell from './ChartShell'
import type { EngagementWeek } from '@/utils/admin/queries'

export default function EngagementChart({ data }: { data: EngagementWeek[] }) {
  return (
    <ChartShell title="Engagement" sub="Lecciones completadas por semana" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={20} />
          <YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="completions" stroke="rgba(var(--primary-rgb), 1)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
