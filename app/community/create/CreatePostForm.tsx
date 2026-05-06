'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Type, FileText, Send } from 'lucide-react'
import { submitPost } from '../actions'
import styles from '../community.module.css'

export default function CreatePostForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await submitPost(formData)
      if (result.success) {
        router.push('/community')
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className={styles.createCard}>
      {error && (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      )}

      <div className={styles.formGroup}>
        <label htmlFor="title" className={styles.label}>
          <Type size={12} strokeWidth={2.4} aria-hidden="true" />
          Título
        </label>
        <input
          type="text"
          id="title"
          name="title"
          className={styles.input}
          required
          placeholder="¿Cómo mejorar mi postura?"
          disabled={isPending}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="content" className={styles.label}>
          <FileText size={12} strokeWidth={2.4} aria-hidden="true" />
          Contenido
        </label>
        <textarea
          id="content"
          name="content"
          className={styles.textarea}
          required
          placeholder="Escribe tu duda, experiencia o lo que quieras compartir..."
          rows={10}
          style={{ minHeight: 220 }}
          disabled={isPending}
        />
      </div>

      <button type="submit" className={styles.submitButton} disabled={isPending}>
        <Send size={13} strokeWidth={2.4} aria-hidden="true" />
        {isPending ? 'Enviando…' : 'Publicar'}
      </button>
    </form>
  )
}
