'use client'

import { useState, useTransition } from 'react'
import { toggleLike } from '@/app/actions/comments'
import { submitComment } from '@/app/community/actions'
import { useLanguage } from '@/context/LanguageContext'
import styles from './CommunityCommentTree.module.css'

// Mapeo de códigos máquina de las server actions a mensajes en español.
// Los códigos desconocidos (o mensajes ya legibles) se muestran tal cual.
const ERROR_MESSAGES: Record<string, string> = {
  auth: 'Debes iniciar sesión para participar.',
  rate_limit: 'Demasiadas acciones seguidas. Espera un momento e inténtalo de nuevo.',
  like_failed: 'No se pudo registrar el like. Inténtalo de nuevo.',
}

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? code
}

export type CommunityComment = {
  id: string
  content: string
  user_id: string
  parent_id: string | null
  created_at: string
  author_name: string
  author_avatar: string | null
  likes_count: number
  user_has_liked: boolean
  replies: CommunityComment[]
}

type Props = {
  postId: string
  comments: CommunityComment[]
  currentUserId: string | null
}

function CommentNode({
  comment, postId, currentUserId, depth,
}: { comment: CommunityComment; postId: string; currentUserId: string | null; depth: number }) {
  const { t } = useLanguage()
  const [liked, setLiked] = useState(comment.user_has_liked)
  const [count, setCount] = useState(comment.likes_count)
  const [showReply, setShowReply] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [likeError, setLikeError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isLikePending, startLikeTransition] = useTransition()

  const onLike = () => {
    if (!currentUserId || isLikePending) return
    const next = !liked
    setLiked(next)
    setCount(c => c + (next ? 1 : -1))
    setLikeError(null)
    startLikeTransition(async () => {
      const res = await toggleLike(comment.id)
      if (res && 'error' in res && typeof res.error === 'string') {
        // Revertir el optimistic update si la acción falló
        setLiked(!next)
        setCount(c => c - (next ? 1 : -1))
        setLikeError(errorMessage(res.error))
      }
    })
  }

  function handleReplySubmit(formData: FormData) {
    setReplyError(null)
    startTransition(async () => {
      const result = await submitComment(formData)
      if (result.success) {
        setShowReply(false)
      } else {
        setReplyError(errorMessage(result.error))
      }
    })
  }

  return (
    <div className={styles.node} id={`comment-${comment.id}`}>
      <div className={styles.header}>
        <strong>{comment.author_name}</strong>
        {/* Locale y zona horaria fijados para que servidor y cliente rendericen
            lo mismo (evita hydration mismatch en este client component SSR'd) */}
        <span className={styles.date}>
          {new Date(comment.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
        </span>
      </div>
      <p className={styles.body}>{comment.content}</p>
      <div className={styles.actions}>
        <button
          type="button"
          onClick={onLike}
          className={liked ? styles.liked : ''}
          disabled={!currentUserId || isLikePending}
          aria-pressed={liked}
        >
          ♥ {count}
        </button>
        {likeError && <span role="alert" className={styles.likeError}>{likeError}</span>}
        {currentUserId && depth === 0 && (
          <button type="button" onClick={() => setShowReply(s => !s)}>
            {showReply ? t.community.cancel : t.community.reply}
          </button>
        )}
      </div>

      {showReply && (
        <form action={handleReplySubmit} className={styles.replyForm}>
          {replyError && <p role="alert">{replyError}</p>}
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="parentId" value={comment.id} />
          <textarea name="content" required maxLength={5000} placeholder={t.community.writeReply} disabled={isPending} />
          <button type="submit" disabled={isPending}>{isPending ? t.community.sending : t.community.publish}</button>
        </form>
      )}

      {comment.replies.length > 0 && (
        <div className={styles.replies}>
          {comment.replies.map(r => (
            <CommentNode key={r.id} comment={r} postId={postId} currentUserId={currentUserId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommunityCommentTree({ postId, comments, currentUserId }: Props) {
  return (
    <div className={styles.tree}>
      {comments.map(c => (
        <CommentNode key={c.id} comment={c} postId={postId} currentUserId={currentUserId} depth={0} />
      ))}
    </div>
  )
}
