'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as UpChunk from '@mux/upchunk'
import { createMuxUpload, deleteMuxAsset } from '@/app/courses/mux-actions'
import styles from './VideoUploadWidget.module.css'

type Status = 'idle' | 'creating' | 'uploading' | 'polling' | 'ready' | 'errored'

interface Props {
  lessonId: string
  currentStatus: 'pending_upload' | 'preparing' | 'ready' | 'errored'
  currentPlaybackId: string | null
}

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 100 // 5 min

export default function VideoUploadWidget({ lessonId, currentStatus, currentPlaybackId }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>(
    currentStatus === 'ready' ? 'ready' :
    currentStatus === 'preparing' ? 'polling' :
    currentStatus === 'errored' ? 'errored' : 'idle'
  )
  const [playbackId, setPlaybackId] = useState<string | null>(currentPlaybackId)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollTimerRef = useRef<number | null>(null)
  const isCancelledRef = useRef(false)
  const isPollingRef = useRef(false)

  const startPolling = useCallback(() => {
    if (isPollingRef.current) return
    isPollingRef.current = true
    let attempts = 0
    const tick = async () => {
      if (isCancelledRef.current) return
      attempts++
      try {
        const res = await fetch(`/api/mux/status/${lessonId}`)
        const data = await res.json()
        if (data.status === 'ready') {
          isPollingRef.current = false
          if (data.playbackId) setPlaybackId(data.playbackId)
          setStatus('ready')
          router.refresh()
          return
        }
        if (data.status === 'errored') {
          isPollingRef.current = false
          setStatus('errored')
          const reasonMap: Record<string, string> = {
            upload_errored: 'La subida a Mux falló. Inténtalo de nuevo.',
            upload_cancelled: 'La subida fue cancelada.',
            upload_timed_out: 'La subida expiró sin recibir el fichero. Vuelve a intentarlo.',
            invalid_input: 'El fichero no es un vídeo válido (codec/contenedor no soportado o fichero corrupto).',
          }
          const baseMsg = reasonMap[data.reason as string] ?? 'Mux no pudo procesar el vídeo.'
          const muxDetail = Array.isArray(data.muxMessages) && data.muxMessages.length > 0
            ? ` (Mux: ${data.muxMessages.join('; ')})`
            : ''
          setError(baseMsg + muxDetail)
          return
        }
        if (attempts >= POLL_MAX_ATTEMPTS) {
          isPollingRef.current = false
          setStatus('errored')
          setError('El procesamiento está tardando demasiado. Refresca la página para volver a comprobar.')
          return
        }
        pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS)
      } catch {
        pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS)
      }
    }
    tick()
  }, [lessonId, router])

  useEffect(() => {
    isCancelledRef.current = false
    if (currentStatus === 'preparing') {
      startPolling()
    }
    return () => {
      isCancelledRef.current = true
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [currentStatus, startPolling])

  const handleFile = async (file: File) => {
    setError(null)
    setStatus('creating')
    const result = await createMuxUpload(lessonId, window.location.origin)
    if ('error' in result) {
      setStatus('errored')
      setError(result.error ?? 'Error desconocido.')
      return
    }
    setStatus('uploading')
    setProgress(0)
    const upload = UpChunk.createUpload({ endpoint: result.uploadUrl ?? '', file, chunkSize: 5120 })
    upload.on('progress', (e) => setProgress(Math.round((e.detail as number))))
    upload.on('error', (e) => {
      setStatus('errored')
      setError((e.detail as { message?: string })?.message ?? 'Error de subida.')
    })
    upload.on('success', () => {
      setStatus('polling')
      setProgress(100)
      startPolling()
    })
  }

  const handleReplace = async () => {
    if (!confirm('¿Eliminar el vídeo actual y subir uno nuevo?')) return
    setStatus('creating')
    const res = await deleteMuxAsset(lessonId)
    if ('error' in res) {
      setStatus('errored')
      setError(res.error ?? 'Error desconocido.')
      return
    }
    setStatus('idle')
    setPlaybackId(null)
    setError(null)
    router.refresh()
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Vídeo</h3>

      {status === 'ready' && playbackId && (
        <div className={styles.readyState}>
          <p className={styles.readyText}>✓ Vídeo listo (playback_id: <code>{playbackId.slice(0, 8)}…</code>)</p>
          <button type="button" onClick={handleReplace} className={styles.replaceBtn}>
            Reemplazar vídeo
          </button>
        </div>
      )}

      {(status === 'idle' || status === 'errored') && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {status === 'creating' && <p>Preparando subida…</p>}
      {status === 'uploading' && (
        <div>
          <p>Subiendo: {progress}%</p>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {status === 'polling' && <p>Procesando vídeo en Mux (puede tardar 1-5 min)…</p>}
    </div>
  )
}
