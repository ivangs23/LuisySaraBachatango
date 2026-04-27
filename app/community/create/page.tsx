import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Type, FileText, Send } from 'lucide-react'
import { submitPost } from '../actions'
import styles from '../community.module.css'

export default async function CreatePostPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/community/create')
  }

  return (
    <div className={styles.container}>
      <section className={styles.detailHero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.detailInner}>
          <Link href="/community" className={styles.backLink}>
            <ArrowLeft size={14} strokeWidth={2.4} aria-hidden="true" />
            <span>Volver a la comunidad</span>
          </Link>

          <span className={styles.eyebrow}>
            <span className={styles.eyebrowLine} aria-hidden="true" />
            NUEVA PUBLICACIÓN
          </span>

          <h1 className={styles.detailTitle}>Crear nuevo post</h1>
          <p className={styles.heroSub}>
            Comparte tu experiencia, una duda o un evento con la comunidad de bailarines.
          </p>
        </div>
      </section>

      <div className={styles.createMain}>
        <form action={submitPost} className={styles.createCard}>
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
            />
          </div>

          <button type="submit" className={styles.submitButton}>
            <Send size={13} strokeWidth={2.4} aria-hidden="true" />
            Publicar
          </button>
        </form>
      </div>
    </div>
  )
}
