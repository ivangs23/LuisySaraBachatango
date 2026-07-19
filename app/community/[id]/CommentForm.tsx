'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { submitComment } from '../actions'
import { useLanguage } from '@/context/LanguageContext'
import styles from '../community.module.css'

// Mapeo de códigos máquina de submitComment a mensajes en español.
// Los códigos desconocidos (o mensajes ya legibles) se muestran tal cual.
const ERROR_MESSAGES: Record<string, string> = {
  auth: 'Debes iniciar sesión para comentar.',
  rate_limit: 'Estás comentando demasiado rápido. Espera un momento e inténtalo de nuevo.',
}

type Props = {
  postId: string
}

export default function CommentForm({ postId }: Props) {
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await submitComment(formData)
      if (!result.success) {
        setError(ERROR_MESSAGES[result.error] ?? result.error)
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
        placeholder={t.community.writeComment}
        required
        disabled={isPending}
      />
      <button type="submit" className={styles.submitButton} disabled={isPending}>
        <Send size={13} strokeWidth={2.4} aria-hidden="true" />
        {isPending ? t.community.sending : t.community.comment}
      </button>
    </form>
  )
}
