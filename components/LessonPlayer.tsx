'use client'

import MuxPlayer from '@mux/mux-player-react'
import { useRouter } from 'next/navigation'
import { markLessonAsCompleted } from '@/app/courses/actions'

interface Props {
  playbackId: string
  playbackToken: string
  lessonId: string
  lessonTitle: string
  courseId: string
  viewerUserId: string
}

export default function LessonPlayer({
  playbackId, playbackToken, lessonId, lessonTitle, courseId, viewerUserId,
}: Props) {
  const router = useRouter()

  return (
    <MuxPlayer
      playbackId={playbackId}
      tokens={{ playback: playbackToken }}
      metadata={{
        video_id: lessonId,
        video_title: lessonTitle,
        viewer_user_id: viewerUserId,
      }}
      style={{ width: '100%', height: '100%', aspectRatio: '16/9' }}
      onEnded={async () => {
        await markLessonAsCompleted(courseId, lessonId)
        router.refresh()
      }}
    />
  )
}
