'use client'

import React from 'react'
import styles from '@/app/courses/[courseId]/[lessonId]/lesson.module.css'
import { markLessonAsCompleted } from '@/app/courses/actions'


import { useRouter } from 'next/navigation'

interface LessonVideoPlayerProps {
  videoUrl: string
  isSupabaseVideo: boolean
  lessonId: string
  courseId: string
  title: string
}

export default function LessonVideoPlayer({ 
  videoUrl, 
  isSupabaseVideo, 
  lessonId, 
  courseId,
  title
}: LessonVideoPlayerProps) {
  const router = useRouter()
  
  const handleEnded = async () => {
    try {
      await markLessonAsCompleted(courseId, lessonId)
      router.refresh()
    } catch (error) {
      console.error('Failed to mark lesson as completed:', error)
    }
  }

  if (isSupabaseVideo) {
    return (
      <video 
        src={videoUrl} 
        className={styles.videoPlayer} 
        controls 
        controlsList="nodownload"
        onEnded={handleEnded}
      />
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <iframe 
        src={videoUrl} 
        className={styles.videoPlayer} 
        allowFullScreen 
        title={title}
      />
    </div>
  )
}
