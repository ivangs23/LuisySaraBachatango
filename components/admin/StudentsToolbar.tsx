'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import styles from './StudentsToolbar.module.css'

export default function StudentsToolbar({
  initialQ, initialRole, initialSub,
}: { initialQ: string; initialRole: string; initialSub: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function update(patch: Record<string, string>) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v === 'all') sp.delete(k)
      else sp.set(k, v)
    })
    sp.delete('page')
    startTransition(() => router.replace(`?${sp.toString()}`))
  }

  function onSearchChange(v: string) {
    setQ(v)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => update({ q: v }), 300)
  }

  return (
    <div className={styles.bar}>
      <label className={styles.search}>
        <Search size={14} aria-hidden />
        <input
          type="search"
          placeholder="Buscar nombre o email…"
          defaultValue={q}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar alumnos"
        />
      </label>

      <select
        defaultValue={initialRole}
        onChange={(e) => update({ role: e.target.value })}
        aria-label="Filtrar por rol"
        className={styles.select}
      >
        <option value="all">Rol: Todos</option>
        <option value="member">Member</option>
        <option value="premium">Premium</option>
        <option value="admin">Admin</option>
      </select>

      <select
        defaultValue={initialSub}
        onChange={(e) => update({ sub: e.target.value })}
        aria-label="Filtrar por suscripción"
        className={styles.select}
      >
        <option value="all">Suscripción: Todas</option>
        <option value="active">Activa</option>
        <option value="none">Sin suscripción</option>
        <option value="newMonth">Nuevos del mes</option>
      </select>
    </div>
  )
}
