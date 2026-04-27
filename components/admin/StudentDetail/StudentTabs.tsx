'use client'

import { useState, type ReactNode } from 'react'
import styles from './StudentDetail.module.css'

type Tab = { key: string; label: string; content: ReactNode }

export default function StudentTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '')
  const current = tabs.find(t => t.key === active) ?? tabs[0]
  return (
    <div>
      <div role="tablist" className={styles.tabBar}>
        {tabs.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            className={`${styles.tabBtn} ${active === t.key ? styles.tabActive : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  )
}
