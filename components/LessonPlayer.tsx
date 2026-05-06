'use client'

import MuxPlayer from '@mux/mux-player-react'
import { markLessonAsCompleted } from '@/app/courses/actions'
import styles from './LessonPlayer.module.css'

interface Props {
  playbackId: string
  playbackToken: string
  thumbnailToken?: string
  posterUrl?: string | null
  lessonId: string
  lessonTitle: string
  courseId: string
  viewerUserId: string
}

export default function LessonPlayer({
  playbackId, playbackToken, thumbnailToken, posterUrl,
  lessonId, lessonTitle, courseId, viewerUserId,
}: Props) {
  return (
    <div className={styles.wrapper}>
      <MuxPlayer
        playbackId={playbackId}
        tokens={{ playback: playbackToken, thumbnail: thumbnailToken }}
        poster={posterUrl || undefined}
        metadata={{
          video_id: lessonId,
          video_title: lessonTitle,
          viewer_user_id: viewerUserId,
        }}
        className={styles.player}
        onEnded={async () => {
          await markLessonAsCompleted(courseId, lessonId)
        }}
      />
    </div>
  )
}
