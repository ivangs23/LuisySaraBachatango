import { createClient } from '@/utils/supabase/server'
import { submitComment } from '../actions'
import Link from 'next/link'
import styles from '../community.module.css'
import { notFound } from 'next/navigation'

export default async function PostDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('posts')
    .select('*, profiles(full_name)')
    .eq('id', params.id)
    .single()

  if (!post) {
    notFound()
  }

  const { data: comments } = await supabase
    .from('comments')
    .select('*, profiles(full_name)')
    .eq('post_id', params.id)
    .order('created_at', { ascending: true })

  return (
    <div className={styles.detailContainer}>
      <Link href="/community" className={styles.backLink}>← Volver a la comunidad</Link>
      
      <h1 className={styles.detailTitle}>{post.title}</h1>
      <div className={styles.detailMeta}>
        <span>Por {post.profiles?.full_name || 'Usuario'}</span>
        <span> • {new Date(post.created_at).toLocaleDateString()}</span>
      </div>
      
      <div className={styles.detailContent}>
        {post.content}
      </div>

      <div className={styles.commentsSection}>
        <h2 className={styles.commentsTitle}>Comentarios ({comments?.length || 0})</h2>

        <form action={submitComment} className={styles.commentForm}>
          <input type="hidden" name="postId" value={post.id} />
          <textarea 
            name="content" 
            className={styles.textarea} 
            placeholder="Escribe un comentario..." 
            required
            style={{ minHeight: '80px' }}
          />
          <button type="submit" className={styles.submitButton}>Comentar</button>
        </form>

        <div className={styles.commentList}>
          {comments?.map((comment) => (
            <div key={comment.id} className={styles.commentCard}>
              <div className={styles.commentHeader}>
                <span className={styles.commentAuthor}>{comment.profiles?.full_name || 'Usuario'}</span>
                <span>{new Date(comment.created_at).toLocaleDateString()}</span>
              </div>
              <p className={styles.commentText}>{comment.content}</p>
            </div>
          ))}
          
          {comments?.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No hay comentarios aún.</p>
          )}
        </div>
      </div>
    </div>
  )
}
