'use client'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import ChartShell from './ChartShell'
import type { ActiveSubsDay } from '@/utils/admin/queries'

export default function ActiveSubsChart({ data }: { data: ActiveSubsDay[] }) {
  return (
    <ChartShell title="Suscripciones activas en el tiempo" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="activeSubsG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(var(--primary-rgb), 0.5)" />
              <stop offset="100%" stopColor="rgba(var(--primary-rgb), 0.05)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={20} />
          <YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
          <Tooltip />
          <Area type="monotone" dataKey="count" stroke="rgba(var(--primary-rgb), 1)" fill="url(#activeSubsG)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
