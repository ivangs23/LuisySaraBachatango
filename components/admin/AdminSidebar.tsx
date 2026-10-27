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
  FlaskConical,
  Megaphone,
  Mail,
} from 'lucide-react'
import styles from './AdminSidebar.module.css'

type Item = { href: string; label: string; Icon: typeof Users; badge?: number | string; alert?: boolean }

type Props = {
  pendingSubmissions: number
  /** Correos que no salieron (utils/admin/email-status.ts). */
  unsentEmails?: number
  /** Resend rechaza la clave: no sale ningún correo. */
  emailOutage?: boolean
}

export default function AdminSidebar({ pendingSubmissions, unsentEmails = 0, emailOutage = false }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const items: Item[] = [
    { href: '/admin', label: 'Inicio', Icon: LayoutDashboard },
    { href: '/admin/alumnos', label: 'Alumnos', Icon: Users },
    { href: '/admin/estadisticas', label: 'Estadísticas', Icon: BarChart3 },
    { href: '/admin/landing', label: 'Landing', Icon: Megaphone },
    { href: '/admin/entregas', label: 'Entregas', Icon: Inbox, badge: pendingSubmissions },
    {
      href: '/admin/correos', label: 'Correos', Icon: Mail,
      badge: emailOutage ? '!' : unsentEmails, alert: emailOutage || unsentEmails > 0,
    },
    { href: '/admin/cursos', label: 'Cursos', Icon: GraduationCap },
    { href: '/admin/eventos', label: 'Eventos', Icon: CalendarDays },
    { href: '/admin/comunidad', label: 'Comunidad', Icon: MessagesSquare },
    { href: '/admin/pruebas', label: 'Modo pruebas', Icon: FlaskConical },
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
          {items.map(({ href, label, Icon, badge, alert }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.item} ${isActive(href) ? styles.active : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={16} strokeWidth={2} aria-hidden />
              <span>{label}</span>
              {badge && (typeof badge === 'string' || badge > 0) ? (
                <span className={`${styles.badge} ${alert ? styles.badgeAlert : ''}`}>{badge}</span>
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
