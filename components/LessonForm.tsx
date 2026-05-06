'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import styles from './LessonForm.module.css'

type Lesson = {
  id?: string
  title?: string
  description?: string | null
  order?: number
  thumbnail_url?: string | null
  duration?: number | null
  is_free?: boolean
  parent_lesson_id?: string | null
}

type LessonOption = { id: string; title: string; order: number }

interface Props {
  courseId: string
  initialData?: Lesson
  availableParents?: LessonOption[]
  action: (formData: FormData) => Promise<{ error?: string } | void>
}

export default function LessonForm({ courseId, initialData, availableParents, action }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [order, setOrder] = useState(initialData?.order?.toString() ?? '1')
  const [duration, setDuration] = useState(initialData?.duration?.toString() ?? '')
  const [isFree, setIsFree] = useState(initialData?.is_free ?? false)
  const [parentLessonId, setParentLessonId] = useState(initialData?.parent_lesson_id ?? '')
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(initialData?.thumbnail_url ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!thumbnailFile) return
    const url = URL.createObjectURL(thumbnailFile)
    let revoked = false
    queueMicrotask(() => {
      if (!revoked) setThumbnailPreview(url)
    })
    return () => {
      revoked = true
      URL.revokeObjectURL(url)
    }
  }, [thumbnailFile])

  const uploadThumbnail = async (file: File): Promise<string | { error: string }> => {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${courseId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('thumbnails').upload(path, file)
    if (upErr) return { error: upErr.message }
    const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(path)
    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    let thumbnailUrl = initialData?.thumbnail_url ?? ''
    if (thumbnailFile) {
      const result = await uploadThumbnail(thumbnailFile)
      if (typeof result === 'object' && 'error' in result) {
        setError(result.error); setSubmitting(false); return
      }
      thumbnailUrl = result
    }

    const fd = new FormData()
    if (initialData?.id) fd.append('lessonId', initialData.id)
    fd.append('courseId', courseId)
    fd.append('title', title)
    fd.append('description', description)
    fd.append('order', order)
    if (duration) fd.append('duration', duration)
    if (isFree) fd.append('isFree', 'on')
    if (thumbnailUrl) fd.append('thumbnailUrl', thumbnailUrl)
    if (parentLessonId) fd.append('parentLessonId', parentLessonId)

    const result = await action(fd)
    if (result && 'error' in result && result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label>Título</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required />
      </div>
      <div className={styles.field}>
        <label>Descripción</label>
        <textarea value={description ?? ''} onChange={e => setDescription(e.target.value)} rows={4} />
      </div>
      {availableParents && availableParents.length > 0 && (
        <div className={styles.field}>
          <label>Lección padre (opcional)</label>
          <select value={parentLessonId} onChange={e => setParentLessonId(e.target.value)}>
            <option value="">— Ninguna (lección de nivel superior) —</option>
            {availableParents.map(p => (
              <option key={p.id} value={p.id}>{p.order}. {p.title}</option>
            ))}
          </select>
        </div>
      )}
      <div className={styles.field}>
        <label>{parentLessonId ? 'Sub-orden (1, 2, 3…)' : 'Orden'}</label>
        <input type="number" min="1" value={order} onChange={e => setOrder(e.target.value)} required />
      </div>
      <div className={styles.field}>
        <label>Duración (segundos, opcional)</label>
        <input type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label>
          <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} />
          {' '}Lección gratuita (accesible sin compra)
        </label>
      </div>
      <div className={styles.field}>
        <label>Miniatura</label>
        {thumbnailPreview && <img src={thumbnailPreview} alt="" style={{ maxWidth: 200, marginBottom: 8 }} />}
        <input type="file" accept="image/*" onChange={e => setThumbnailFile(e.target.files?.[0] ?? null)} />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Guardando…' : initialData?.id ? 'Guardar cambios' : 'Crear lección'}
      </button>
    </form>
  )
}
