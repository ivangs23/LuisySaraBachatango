'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import ChartShell from './ChartShell'
import type { TrafficDay } from '@/utils/admin/landing-queries'

export default function LandingTrafficChart({ data }: { data: TrafficDay[] }) {
  return (
    <ChartShell title="Tráfico" sub="Vistas y únicos por día" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={34} allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="views" name="Vistas" stroke="rgba(var(--primary-rgb), 0.9)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="uniques" name="Únicos/día" stroke="rgba(120,160,220,0.9)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
