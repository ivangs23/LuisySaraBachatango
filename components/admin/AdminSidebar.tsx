'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Inbox,
  GraduationCap,
  MessagesSquare,
  CalendarDays,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react'
import styles from './AdminSidebar.module.css'

type Item = { href: string; label: string; Icon: typeof Users; badge?: number }

export default function AdminSidebar({ pendingSubmissions }: { pendingSubmissions: number }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const items: Item[] = [
    { href: '/admin', label: 'Inicio', Icon: LayoutDashboard },
    { href: '/admin/alumnos', label: 'Alumnos', Icon: Users },
    { href: '/admin/estadisticas', label: 'Estadísticas', Icon: BarChart3 },
    { href: '/admin/entregas', label: 'Entregas', Icon: Inbox, badge: pendingSubmissions },
    { href: '/admin/cursos', label: 'Cursos', Icon: GraduationCap },
    { href: '/admin/eventos', label: 'Eventos', Icon: CalendarDays },
    { href: '/admin/comunidad', label: 'Comunidad', Icon: MessagesSquare },
  ]

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href)

  return (
    <>
      <button
        className={styles.burger}
        aria-label="Abrir menú admin"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>

      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.brand}>
          <span className={styles.brandTitle}>Luis &amp; Sara</span>
          <span className={styles.brandLabel}>Admin</span>
          <button
            className={styles.close}
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className={styles.nav}>
          {items.map(({ href, label, Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.item} ${isActive(href) ? styles.active : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={16} strokeWidth={2} aria-hidden />
              <span>{label}</span>
              {badge && badge > 0 ? (
                <span className={styles.badge}>{badge}</span>
              ) : null}
            </Link>
          ))}

          <Link
            href="/dashboard"
            className={styles.item}
            onClick={() => setOpen(false)}
          >
            <ArrowLeft size={16} strokeWidth={2} aria-hidden />
            <span>Volver al sitio</span>
          </Link>
        </nav>
      </aside>

      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}
    </>
  )
}
