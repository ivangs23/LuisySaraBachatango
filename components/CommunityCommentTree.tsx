'use client'

import { useState, useTransition } from 'react'
import { toggleLike } from '@/app/actions/comments'
import { submitComment } from '@/app/community/actions'
import styles from './CommunityCommentTree.module.css'

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
  const [liked, setLiked] = useState(comment.user_has_liked)
  const [count, setCount] = useState(comment.likes_count)
  const [showReply, setShowReply] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onLike = () => {
    if (!currentUserId) return
    const next = !liked
    setLiked(next)
    setCount(c => c + (next ? 1 : -1))
    startTransition(() => { void toggleLike(comment.id) })
  }

  function handleReplySubmit(formData: FormData) {
    setReplyError(null)
    startTransition(async () => {
      const result = await submitComment(formData)
      if (result.success) {
        setShowReply(false)
      } else {
        setReplyError(result.error)
      }
    })
  }

  return (
    <div className={styles.node} id={`comment-${comment.id}`}>
      <div className={styles.header}>
        <strong>{comment.author_name}</strong>
        <span className={styles.date}>{new Date(comment.created_at).toLocaleString()}</span>
      </div>
      <p className={styles.body}>{comment.content}</p>
      <div className={styles.actions}>
        <button type="button" onClick={onLike} className={liked ? styles.liked : ''} disabled={!currentUserId}>
          ♥ {count}
        </button>
        {currentUserId && depth === 0 && (
          <button type="button" onClick={() => setShowReply(s => !s)}>
            {showReply ? 'Cancelar' : 'Responder'}
          </button>
        )}
      </div>

      {showReply && (
        <form action={handleReplySubmit} className={styles.replyForm}>
          {replyError && <p role="alert">{replyError}</p>}
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="parentId" value={comment.id} />
          <textarea name="content" required maxLength={5000} placeholder="Escribe tu respuesta…" disabled={isPending} />
          <button type="submit" disabled={isPending}>{isPending ? 'Enviando…' : 'Publicar'}</button>
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
