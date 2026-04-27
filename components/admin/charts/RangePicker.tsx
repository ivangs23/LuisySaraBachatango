'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import styles from './charts.module.css'

const RANGES: { key: '30' | '90' | '365' | 'all'; label: string }[] = [
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: '365', label: '1 año' },
  { key: 'all', label: 'Todo' },
]

export default function RangePicker({ value }: { value: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  function setRange(v: string) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    if (v === '90') sp.delete('range')
    else sp.set('range', v)
    startTransition(() => router.replace(`?${sp.toString()}`))
  }

  return (
    <div role="tablist" className={styles.tabs}>
      {RANGES.map(r => (
        <button
          key={r.key}
          role="tab"
          aria-selected={value === r.key}
          className={`${styles.tab} ${value === r.key ? styles.tabActive : ''}`}
          onClick={() => setRange(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
