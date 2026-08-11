'use client'

import MuxPlayer from '@mux/mux-player-react'
import styles from './LessonPlayer.module.css'

interface Props {
  playbackId: string
  playbackToken: string
  thumbnailToken: string
  posterUrl: string | null
  title: string
}

/**
 * Reproductor de la clase gratis pública. No es `LessonPlayer` porque aquel
 * llama a `markLessonAsCompleted()` al terminar, y eso requiere sesión: aquí
 * el espectador puede ser anónimo. Sin `viewer_user_id` en metadata por la
 * misma razón.
 *
 * Reutiliza `LessonPlayer.module.css` — el envoltorio y el ratio son idénticos.
 */
export default function FreeClassPlayer({
  playbackId, playbackToken, thumbnailToken, posterUrl, title,
}: Props) {
  return (
    <div className={styles.wrapper}>
      <MuxPlayer
        playbackId={playbackId}
        tokens={{ playback: playbackToken, thumbnail: thumbnailToken }}
        poster={posterUrl || undefined}
        metadata={{ video_title: title }}
        className={styles.player}
      />
    </div>
  )
}
