'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import ChartShell from './ChartShell'
import type { TopCourseRow } from '@/utils/admin/queries'

export default function TopCoursesChart({ data }: { data: TopCourseRow[] }) {
  return (
    <ChartShell title="Top cursos" sub="Compras y alumnos activos" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="course" tick={{ fontSize: 11 }} width={140} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="purchases" fill="rgba(var(--primary-rgb), 1)" name="Compras" />
          <Bar dataKey="learners" fill="rgba(var(--primary-rgb), 0.4)" name="Alumnos activos" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
