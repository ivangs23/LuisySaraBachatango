import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { submitComment } from '../actions'
import Link from 'next/link'
import { ArrowLeft, MessageCircleMore, Send } from 'lucide-react'
import styles from '../community.module.css'
import { notFound } from 'next/navigation'
import PostLikeButton from '@/components/PostLikeButton'
import CommunityCommentTree, { type CommunityComment } from '@/components/CommunityCommentTree'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from('posts')
    .select('title, content, profiles(full_name)')
    .eq('id', id)
    .single()

  if (!post) return { title: 'Post no encontrado' }

  const description = post.content?.slice(0, 160) ?? 'Publicación de la comunidad de Luis y Sara Bachatango.'
  const profilesData = post.profiles as { full_name: string | null } | { full_name: string | null }[] | null
  const author = (Array.isArray(profilesData) ? profilesData[0]?.full_name : profilesData?.full_name) ?? 'Un miembro'

  return {
    title: post.title,
    description,
    openGraph: {
      title: `${post.title} | Comunidad Bachatango`,
      description,
      url: `/community/${id}`,
      type: 'article',
      images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: post.title }],
    },
    alternates: { canonical: `/community/${id}` },
    authors: [{ name: author }],
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default async function PostDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: post } = await supabase
    .from('posts')
    .select('*, profiles(full_name)')
    .eq('id', params.id)
    .single()

  if (!post) {
    notFound()
  }

  const { data: likes } = await supabase
    .from('post_likes')
    .select('user_id')
    .eq('post_id', params.id)

  const likeCount = likes?.length ?? 0
  const userLiked = !!user && !!likes?.some((l: { user_id: string }) => l.user_id === user.id)

  const { data: rawComments } = await supabase
    .from('comments')
    .select('id, content, user_id, parent_id, created_at')
    .eq('post_id', params.id)
    .order('created_at', { ascending: true })

  const userIds = Array.from(new Set((rawComments ?? []).map((c: { user_id: string }) => c.user_id)))
  const safeUserIds = userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', safeUserIds)

  const commentIds = (rawComments ?? []).map((c: { id: string }) => c.id)
  const safeCommentIds = commentIds.length ? commentIds : ['00000000-0000-0000-0000-000000000000']
  const { data: commentLikes } = await supabase
    .from('comment_likes')
    .select('comment_id, user_id')
    .in('comment_id', safeCommentIds)

  const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>(
    (profiles ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [p.id, p])
  )

  const enriched = (rawComments ?? []).map((c) => {
    const cl = (commentLikes ?? []).filter((l: { comment_id: string }) => l.comment_id === c.id)
    const profile = profileMap.get(c.user_id)
    const node: CommunityComment = {
      id: c.id,
      content: c.content,
      user_id: c.user_id,
      parent_id: c.parent_id,
      created_at: c.created_at,
      author_name: profile?.full_name ?? 'Usuario',
      author_avatar: profile?.avatar_url ?? null,
      likes_count: cl.length,
      user_has_liked: !!user && cl.some((l: { user_id: string }) => l.user_id === user.id),
      replies: [],
    }
    return node
  })

  const byId = new Map(enriched.map(c => [c.id, c]))
  const roots: CommunityComment[] = []
  enriched.forEach(c => {
    if (c.parent_id) {
      const parent = byId.get(c.parent_id)
      if (parent) parent.replies.push(c)
      else roots.push(c)
    } else {
      roots.push(c)
    }
  })

  const authorName = post.profiles?.full_name || 'Usuario'
  const initial = authorName[0]?.toUpperCase() || 'U'
  const commentCount = rawComments?.length || 0

  return (
    <div className={styles.detailContainer}>
      <section className={styles.detailHero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.detailInner}>
          <Link href="/community" className={styles.backLink}>
            <ArrowLeft size={14} strokeWidth={2.4} aria-hidden="true" />
            <span>Volver a la comunidad</span>
          </Link>

          <span className={styles.eyebrow}>
            <span className={styles.eyebrowLine} aria-hidden="true" />
            POST DE LA COMUNIDAD
          </span>

          <h1 className={styles.detailTitle}>{post.title}</h1>

          <div className={styles.detailMeta}>
            <span className={styles.detailAvatar} aria-hidden="true">
              {initial}
            </span>
            <span className={styles.detailMetaText}>
              <span className={styles.detailMetaAuthor}>{authorName}</span>
              <span>{formatDate(post.created_at)}</span>
            </span>
          </div>
        </div>
      </section>

      <div className={styles.detailBody}>
        <div className={styles.detailContent}>{post.content}</div>

        <div className={styles.detailActions}>
          <PostLikeButton postId={post.id} initialLiked={userLiked} initialCount={likeCount} />
        </div>
      </div>

      <section className={styles.commentsSection}>
        <div className={styles.commentsHeader}>
          <span className={styles.commentsEyebrow}>
            <span className={styles.commentsEyebrowLine} aria-hidden="true" />
            CONVERSACIÓN
          </span>
          <h2 className={styles.commentsTitle}>
            Comentarios ({commentCount})
          </h2>
        </div>

        {user ? (
          <form action={submitComment} className={styles.commentForm}>
            <input type="hidden" name="postId" value={post.id} />
            <textarea
              name="content"
              className={styles.textarea}
              placeholder="Escribe un comentario..."
              required
            />
            <button type="submit" className={styles.submitButton}>
              <Send size={13} strokeWidth={2.4} aria-hidden="true" />
              Comentar
            </button>
          </form>
        ) : (
          <div className={styles.commentLoginPrompt}>
            <Link href="/login?next=/community">Inicia sesión</Link> para dejar un comentario.
          </div>
        )}

        {roots.length === 0 ? (
          <div className={styles.commentsEmpty}>
            <MessageCircleMore
              size={20}
              strokeWidth={1.8}
              style={{ marginBottom: 6, opacity: 0.7 }}
              aria-hidden="true"
            />
            <p style={{ margin: 0 }}>No hay comentarios todavía. Sé el primero en participar.</p>
          </div>
        ) : (
          <CommunityCommentTree
            postId={post.id}
            comments={roots}
            currentUserId={user?.id ?? null}
          />
        )}
      </section>
    </div>
  )
}
