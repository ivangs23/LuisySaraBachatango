import Image from 'next/image'
import { sanitizeUrl } from '@/utils/sanitize'
import { formatRelative } from '@/utils/admin/metrics'
import type { StudentDetail } from '@/utils/admin/queries'
import StudentActions from './StudentActions'
import styles from './StudentDetail.module.css'

const PLAN_LABEL: Record<string, string> = { '1month': 'Mensual', '6months': '6 meses', '1year': 'Anual' }

export default function StudentSummaryCard({
  data, courses,
}: { data: StudentDetail; courses: { id: string; title: string }[] }) {
  const p = data.profile
  const sub = data.subscription
  const isActive = sub && (sub.status === 'active' || sub.status === 'trialing')
  const socials: Array<['instagram' | 'facebook' | 'tiktok' | 'youtube', string | null]> = [
    ['instagram', p.instagram], ['facebook', p.facebook], ['tiktok', p.tiktok], ['youtube', p.youtube],
  ]

  return (
    <aside className={styles.summary}>
      <div className={styles.summaryHead}>
        {p.avatar_url
          ? <Image src={p.avatar_url} alt="" width={64} height={64} className={styles.avatar} />
          : <span className={styles.avatarFallback} aria-hidden />}
        <div>
          <h2 className={styles.name}>{p.full_name ?? 'Sin nombre'}</h2>
          <p className={styles.email}>{p.email}</p>
          <p className={styles.meta}>
            <span className={`${styles.roleBadge} ${styles[`role_${p.role}`]}`}>{p.role}</span>
            {' · alta '}{formatRelative(p.created_at)}
          </p>
        </div>
      </div>

      <section className={styles.summaryBlock}>
        <h3>Suscripción</h3>
        {isActive ? (
          <>
            <p>✓ {sub?.plan_type ? (PLAN_LABEL[sub.plan_type] ?? sub.plan_type) : 'Activa'}</p>
            <p className={styles.dim}>
              {sub?.current_period_start?.slice(0, 10)} → {sub?.current_period_end?.slice(0, 10)}
            </p>
            {p.stripe_customer_id && (
              <a
                href={`https://dashboard.stripe.com/customers/${p.stripe_customer_id}`}
                target="_blank" rel="noopener noreferrer"
                className={styles.link}
              >
                Stripe ↗
              </a>
            )}
          </>
        ) : (
          <p className={styles.dim}>Sin suscripción activa</p>
        )}
      </section>

      <section className={styles.summaryBlock}>
        <h3>Redes</h3>
        {socials.every(([, v]) => !sanitizeUrl(v)) && <p className={styles.dim}>Sin redes.</p>}
        <ul className={styles.socials}>
          {socials.map(([key, val]) => {
            const safe = sanitizeUrl(val)
            if (!safe) return null
            return (
              <li key={key}>
                <a href={safe} target="_blank" rel="noopener noreferrer" className={styles.link}>{key} ↗</a>
              </li>
            )
          })}
        </ul>
      </section>

      <StudentActions userId={data.profile.id} userEmail={data.profile.email} currentRole={data.profile.role} courses={courses} />
    </aside>
  )
}
