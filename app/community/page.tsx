import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import styles from './community.module.css'

export default async function CommunityPage() {
  const supabase = await createClient()

  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Comunidad</h1>
        <Link href="/community/create" className={styles.createButton}>
          Crear Post
        </Link>
      </div>

      <div className={styles.postList}>
        {posts?.map((post) => (
          <Link key={post.id} href={`/community/${post.id}`} className={styles.postCard}>
            <h2 className={styles.postTitle}>{post.title}</h2>
            <div className={styles.postMeta}>
              <span>Por {post.profiles?.full_name || 'Usuario'}</span>
              <span>{new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            <p className={styles.postContent}>{post.content}</p>
          </Link>
        ))}

        {posts?.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay posts aún. ¡Sé el primero en preguntar!
          </p>
        )}
      </div>
    </div>
  )
}
