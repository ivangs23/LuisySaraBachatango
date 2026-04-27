'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import styles from './AdminRevenueChart.module.css'
import type { RevenueDay } from '@/utils/admin/queries'

type Props = { data: RevenueDay[]; range: 30 | 90 }

export default function AdminRevenueChart({ data, range }: Props) {
  const [, startTransition] = useTransition()
  const router = useRouter()
  const params = useSearchParams()
  const [activeRange, setActiveRange] = useState<30 | 90>(range)

  const total = useMemo(
    () => data.reduce((s, d) => s + d.purchases + d.subscriptions, 0),
    [data]
  )

  function setRange(next: 30 | 90) {
    setActiveRange(next)
    const sp = new URLSearchParams(params?.toString() ?? '')
    sp.set('range', String(next))
    startTransition(() => router.replace(`?${sp.toString()}`))
  }

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Ingresos</h2>
          <p className={styles.sub}>
            Total {activeRange}d: <strong>€{total.toFixed(0)}</strong>
          </p>
        </div>
        <div role="tablist" className={styles.tabs}>
          <button
            type="button"
            role="tab"
            aria-selected={activeRange === 30}
            className={`${styles.tab} ${activeRange === 30 ? styles.tabActive : ''}`}
            onClick={() => setRange(30)}
          >
            30d
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeRange === 90}
            className={`${styles.tab} ${activeRange === 90 ? styles.tabActive : ''}`}
            onClick={() => setRange(90)}
          >
            90d
          </button>
        </div>
      </header>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="purchasesG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(var(--primary-rgb), 1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="rgba(var(--primary-rgb), 1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="subsG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(var(--primary-rgb), 1)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="rgba(var(--primary-rgb), 1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(d: string) => d.slice(5)}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis tick={{ fontSize: 11 }} width={36} />
            <Tooltip
              formatter={(v: number) => `€${Number(v).toFixed(0)}`}
              labelFormatter={(d) => `${d}`}
            />
            <Area
              type="monotone"
              dataKey="subscriptions"
              stackId="1"
              stroke="rgba(var(--primary-rgb), 0.65)"
              fill="url(#subsG)"
              name="Suscripciones"
            />
            <Area
              type="monotone"
              dataKey="purchases"
              stackId="1"
              stroke="rgba(var(--primary-rgb), 1)"
              fill="url(#purchasesG)"
              name="Compras"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
