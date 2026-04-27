import Link from 'next/link'
import { listRecentPosts, listRecentComments } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import DeletePostBtn from './DeletePostBtn'
import DeleteCommentBtn from './DeleteCommentBtn'

export const dynamic = 'force-dynamic'

export default async function ComunidadAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sp = await searchParams
  const tab = sp.tab === 'comments' ? 'comments' : 'posts'
  const [posts, comments] = await Promise.all([
    listRecentPosts(),
    listRecentComments(),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', fontWeight: 600 }}>Comunidad</h1>

      <nav style={{ display: 'flex', gap: '0.5rem' }}>
        <Link
          href="?tab=posts"
          style={{
            padding: '0.4rem 0.85rem', borderRadius: 6, textDecoration: 'none',
            background: tab === 'posts' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
            color: tab === 'posts' ? 'rgba(var(--primary-rgb), 1)' : 'inherit',
            fontSize: '0.88rem', fontWeight: tab === 'posts' ? 600 : 400,
          }}
        >Posts ({posts.length})</Link>
        <Link
          href="?tab=comments"
          style={{
            padding: '0.4rem 0.85rem', borderRadius: 6, textDecoration: 'none',
            background: tab === 'comments' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
            color: tab === 'comments' ? 'rgba(var(--primary-rgb), 1)' : 'inherit',
            fontSize: '0.88rem', fontWeight: tab === 'comments' ? 600 : 400,
          }}
        >Comentarios ({comments.length})</Link>
      </nav>

      {tab === 'posts' && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {posts.map(p => (
            <li key={p.id} style={{
              padding: '0.7rem 0.85rem',
              border: '1px solid rgba(var(--primary-rgb), 0.08)',
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href={`/admin/alumnos/${p.user_id}`} style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                  {p.user_name ?? 'Sin nombre'}
                </Link>
                <span style={{ fontSize: '0.78rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>
                  {formatRelative(p.created_at)} · ♥ {p.likeCount} · 💬 {p.commentCount}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                {p.content.slice(0, 320)}{p.content.length > 320 ? '…' : ''}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                <Link href={`/community/${p.id}`} style={{ fontSize: '0.82rem', color: 'rgba(var(--primary-rgb), 1)' }}>
                  Ver post ↗
                </Link>
                <DeletePostBtn id={p.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'comments' && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {comments.map(c => (
            <li key={c.id} style={{
              padding: '0.7rem 0.85rem',
              border: '1px solid rgba(var(--primary-rgb), 0.08)',
              borderRadius: 6,
              display: 'flex', flexDirection: 'column', gap: '0.35rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href={`/admin/alumnos/${c.user_id}`} style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                  {c.user_name ?? 'Sin nombre'}
                </Link>
                <span style={{ fontSize: '0.78rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>
                  {formatRelative(c.created_at)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                {c.content.slice(0, 320)}{c.content.length > 320 ? '…' : ''}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link href={`/community/${c.post_id}`} style={{ fontSize: '0.82rem', color: 'rgba(var(--primary-rgb), 1)' }}>
                  Ver post ↗
                </Link>
                <DeleteCommentBtn id={c.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
