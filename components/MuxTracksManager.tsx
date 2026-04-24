'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  SUPPORTED_LANGUAGES,
  validateAudioFile,
  validateSubtitleFile,
} from '@/utils/mux/validation'
import {
  addMuxAudioTrack,
  addMuxTextTrack,
  deleteMuxTrack,
  type MuxTrackSummary,
} from '@/app/courses/mux-actions'
import styles from './MuxTracksManager.module.css'

interface Props {
  lessonId: string
  tracks: MuxTrackSummary[]
}

export default function MuxTracksManager({ lessonId, tracks }: Props) {
  const [isPending, startTransition] = useTransition()
  const audio = tracks.filter(t => t.type === 'audio')
  const text = tracks.filter(t => t.type === 'text')

  return (
    <div className={styles.container}>
      <TrackSection
        title="Pistas de audio alternativas"
        kind="audio"
        tracks={audio}
        lessonId={lessonId}
        isPending={isPending}
        startTransition={startTransition}
      />
      <TrackSection
        title="Subtítulos"
        kind="text"
        tracks={text}
        lessonId={lessonId}
        isPending={isPending}
        startTransition={startTransition}
      />
    </div>
  )
}

function TrackSection({
  title, kind, tracks, lessonId, isPending, startTransition,
}: {
  title: string
  kind: 'audio' | 'text'
  tracks: MuxTrackSummary[]
  lessonId: string
  isPending: boolean
  startTransition: (fn: () => void) => void
}) {
  const [adding, setAdding] = useState(false)
  const [languageCode, setLanguageCode] = useState('es')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Selecciona un archivo.'); return }

    const validationError = kind === 'audio'
      ? validateAudioFile({ type: file.type, size: file.size })
      : validateSubtitleFile({ type: file.type, size: file.size, name: file.name })
    if (validationError) { setError(validationError); return }

    setError(null)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? (kind === 'audio' ? 'mp4' : 'vtt')
    const path = `${lessonId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('mux-track-sources').upload(path, file)
    if (upErr) { setError(`Error subiendo a Storage: ${upErr.message}`); return }
    const { data: { publicUrl } } = supabase.storage.from('mux-track-sources').getPublicUrl(path)

    const name = SUPPORTED_LANGUAGES.find(l => l.code === languageCode)?.label ?? languageCode
    startTransition(async () => {
      const action = kind === 'audio'
        ? addMuxAudioTrack(lessonId, languageCode, name, publicUrl)
        : addMuxTextTrack(lessonId, languageCode, name, publicUrl)
      const result = await action
      if ('error' in result && result.error) { setError(result.error); return }
      setAdding(false)
      setFile(null)
    })
  }

  const handleDelete = async (trackId: string) => {
    if (!confirm('¿Eliminar esta pista?')) return
    startTransition(async () => {
      await deleteMuxTrack(lessonId, trackId)
    })
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {tracks.length === 0 && <p className={styles.empty}>Sin pistas.</p>}
      <ul className={styles.list}>
        {tracks.map(t => (
          <li key={t.id} className={styles.item}>
            <span className={styles.flag}>{kind === 'audio' ? '🔊' : '💬'}</span>
            <span className={styles.name}>{t.name ?? t.languageCode ?? '(sin idioma)'}</span>
            <span className={styles.status}>{t.status ?? ''}</span>
            <button
              type="button"
              onClick={() => handleDelete(t.id)}
              disabled={isPending}
              className={styles.deleteBtn}
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      {!adding && (
        <button type="button" onClick={() => setAdding(true)} className={styles.addBtn}>
          + Añadir {kind === 'audio' ? 'pista de audio' : 'subtítulos'}
        </button>
      )}

      {adding && (
        <form onSubmit={handleAdd} className={styles.form}>
          <select value={languageCode} onChange={e => setLanguageCode(e.target.value)}>
            {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <input
            type="file"
            accept={kind === 'audio' ? 'audio/*,video/mp4' : '.vtt,text/vtt'}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit" disabled={isPending || !file}>
            {isPending ? 'Añadiendo…' : 'Añadir'}
          </button>
          <button type="button" onClick={() => { setAdding(false); setFile(null); setError(null); }}>
            Cancelar
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      )}
    </section>
  )
}
