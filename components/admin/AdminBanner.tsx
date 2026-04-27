import Link from 'next/link'
import { ArrowUpRight, Shield } from 'lucide-react'
import styles from './AdminBanner.module.css'

export default function AdminBanner() {
  return (
    <Link href="/admin" className={styles.banner}>
      <span className={styles.icon} aria-hidden><Shield size={14} /></span>
      <span className={styles.text}>
        Tienes acceso al <strong>panel de administración</strong>
      </span>
      <ArrowUpRight size={14} aria-hidden className={styles.arrow} />
    </Link>
  )
}
