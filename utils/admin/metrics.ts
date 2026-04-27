import {
  PLAN_PRICES_EUR,
  monthlyEquivalent,
  type PlanType,
} from '@/utils/admin/plan-prices'

export function computeMRR(subs: { plan_type: PlanType | null }[]): number {
  return subs.reduce((acc, s) => {
    if (!s.plan_type) return acc
    const total = PLAN_PRICES_EUR[s.plan_type] ?? 0
    return acc + monthlyEquivalent(s.plan_type, total)
  }, 0)
}

export function groupByMonth<T>(
  rows: T[],
  getDate: (r: T) => string,
  getValue: (r: T) => number,
): { month: string; value: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const d = new Date(getDate(r))
    if (Number.isNaN(d.valueOf())) continue
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + getValue(r))
  }
  return [...map.entries()]
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export function pctChange(prev: number, curr: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

export function centsToEur(cents: number | null | undefined): number {
  if (cents == null) return 0
  return Math.round(cents) / 100
}

export function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).valueOf()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `hace ${Math.max(1, min)}min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr}h`
  const d = Math.floor(hr / 24)
  if (d < 30) return `hace ${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `hace ${mo}m`
  return `hace ${Math.floor(mo / 12)}a`
}
