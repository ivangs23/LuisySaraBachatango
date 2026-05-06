'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { submitComment } from '../actions'
import styles from '../community.module.css'

type Props = {
  postId: string
}

export default function CommentForm({ postId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await submitComment(formData)
      if (!result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className={styles.commentForm}>
      {error && <p role="alert">{error}</p>}
      <input type="hidden" name="postId" value={postId} />
      <textarea
        name="content"
        className={styles.textarea}
        placeholder="Escribe un comentario..."
        required
        disabled={isPending}
      />
      <button type="submit" className={styles.submitButton} disabled={isPending}>
        <Send size={13} strokeWidth={2.4} aria-hidden="true" />
        {isPending ? 'Enviando…' : 'Comentar'}
      </button>
    </form>
  )
}
