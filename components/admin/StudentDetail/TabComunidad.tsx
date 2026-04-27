import Link from 'next/link'
import type { StudentDetail } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from './StudentDetail.module.css'

export default function TabComunidad({ data }: { data: StudentDetail }) {
  return (
    <div className={styles.subList}>
      <h3 className={styles.summaryBlockHeading}>Posts</h3>
      {data.community.posts.length === 0 && <p className={styles.dim}>Sin posts.</p>}
      <ul className={styles.subList}>
        {data.community.posts.map(p => (
          <li key={p.id} className={styles.commPost}>
            <p className={styles.commContent}>{p.content.slice(0, 220)}{p.content.length > 220 ? '…' : ''}</p>
            <p className={styles.commMeta}>{formatRelative(p.created_at)}</p>
          </li>
        ))}
      </ul>

      <h3 className={styles.summaryBlockHeading}>Comentarios</h3>
      {data.community.comments.length === 0 && <p className={styles.dim}>Sin comentarios.</p>}
      <ul className={styles.subList}>
        {data.community.comments.map(c => (
          <li key={c.id} className={styles.commPost}>
            <p className={styles.commContent}>{c.content.slice(0, 220)}{c.content.length > 220 ? '…' : ''}</p>
            <p className={styles.commMeta}>
              <Link href={`/community/${c.post_id}`} className={styles.link}>Ver post ↗</Link> · {formatRelative(c.created_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
