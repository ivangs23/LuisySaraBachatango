'use client'

import React, { useState, useRef, useEffect } from 'react'
import styles from './LessonVideoPlayer.module.css'
import lessonStyles from '@/app/courses/[courseId]/[lessonId]/lesson.module.css'
import { markLessonAsCompleted } from '@/app/courses/actions'
import { useRouter } from 'next/navigation'
import { Settings, Check, Globe, MessageSquare } from 'lucide-react'

export interface VideoTrack {
  language: string
  label: string
  url: string
}

export interface SubtitleTrack {
  language: string
  label: string
  url: string // .vtt file url
}

export interface MediaConfig {
  tracks: VideoTrack[]
  subtitles: SubtitleTrack[]
}

interface LessonVideoPlayerProps {
  videoUrl: string
  isSupabaseVideo: boolean
  lessonId: string
  courseId: string
  title: string
  mediaConfig?: MediaConfig
  videoSource?: 'url' | 'upload'
}

export default function LessonVideoPlayer({ 
  videoUrl, // Default/fallback URL
  isSupabaseVideo, 
  lessonId, 
  courseId,
  title,
  mediaConfig,
  videoSource = 'upload' // Default to upload to be safe, but page overrides
}: LessonVideoPlayerProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  
  // State for tracks
  const [currentAudio, setCurrentAudio] = useState<VideoTrack | null>(null)
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleTrack | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Initialize from mediaConfig if available
  useEffect(() => {
    if (mediaConfig?.tracks?.length) {
      // Prefer Spanish or English, otherwise first available
      const preferred = mediaConfig.tracks.find(t => t.language === 'es') || 
                        mediaConfig.tracks.find(t => t.language === 'en') || 
                        mediaConfig.tracks[0]
      setCurrentAudio(preferred)
    }
  }, [mediaConfig])

  // Determine actual source to play
  const sourceUrl = currentAudio ? currentAudio.url : videoUrl

  const handleEnded = async () => {
    try {
      await markLessonAsCompleted(courseId, lessonId)
      router.refresh()
    } catch (error) {
      console.error('Failed to mark lesson as completed:', error)
    }
  }

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

  const changeAudio = (track: VideoTrack) => {
    if (track.url === currentAudio?.url) return
    
    // Save current time and play state
    const currentTime = videoRef.current?.currentTime || 0
    const wasPlaying = !videoRef.current?.paused

    setCurrentAudio(track)
    setIsMenuOpen(false)

    // Restore time and state after render/load
    // Note: The video element execution order handles src change -> load
    // We use a small timeout or effect to seek, but modern React + Video often needs careful handling.
    // However, simply changing src and seeking in onLoadedMetadata is robust.
    
    // We'll trust onLoadedMetadata to handle the seek
    pendingSeek.current = currentTime
    shouldResume.current = wasPlaying
  }

  const changeSubtitle = (track: SubtitleTrack | null) => {
    setCurrentSubtitle(track)
    setIsMenuOpen(false)
  }

  // Refs for seamless switching
  const pendingSeek = useRef<number | null>(null)
  const shouldResume = useRef<boolean>(false)

  const handleLoadedMetadata = () => {
    if (videoRef.current && pendingSeek.current !== null) {
      videoRef.current.currentTime = pendingSeek.current
      pendingSeek.current = null
      
      if (shouldResume.current) {
//        videoRef.current.play().catch(e => console.log('Autoplay prevented on switch', e))
        // Modern browsers might block unmuted autoplay, but since this is user initiated click, it usually passes.
        // We'll try to play.
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log('Playback prevented:', error)
            })
        }
      }
      shouldResume.current = false
    }
  }

  // Determine if we should render Iframe
  // If source is External URL AND we are not playing a specific overriding audio track (which would be a file)
  
  // Robust check: if videoSource says 'url' OR if the videoUrl looks like an embed (YouTube/Vimeo)
  // This handles legacy data or cases where videoSource might be misconfigured
  const isExternalUrl = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') || videoUrl.includes('vimeo.com');
  
  const shouldRenderIframe = (videoSource === 'url' || isExternalUrl) && !currentAudio;

  if (shouldRenderIframe) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <iframe 
          src={videoUrl} 
          className={lessonStyles.videoPlayer} // Reuse existing class for iframe
          allowFullScreen 
          title={title}
        />
      </div>
    )
  }

  return (
    <div className={styles.videoContainer}>
      <video 
        ref={videoRef}
        src={sourceUrl} 
        className={styles.videoPlayer} 
        controls 
        controlsList="nodownload" // Basic protection
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        crossOrigin="anonymous" // Needed for VTT/captions if on different domain
      >
        {currentSubtitle && (
          <track 
            kind="subtitles" 
            label={currentSubtitle.label} 
            srcLang={currentSubtitle.language} 
            src={currentSubtitle.url} 
            default
          />
        )}
      </video>

      {/* Custom Overlay Controls */}
      <div className={styles.controlsOverlay}>
        {((mediaConfig?.tracks?.length ?? 0) > 1 || (mediaConfig?.subtitles?.length ?? 0) > 0) && (
          <div style={{ position: 'relative' }}>
            <button 
              className={styles.settingsButton} 
              onClick={toggleMenu}
              title="Audio & Subtitles"
            >
              <Settings size={20} />
            </button>

            {isMenuOpen && (
              <div className={styles.menu}>
                
                {/* Audio Section */}
                {mediaConfig?.tracks && mediaConfig.tracks.length > 1 && (
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                      <Globe size={14} style={{ display: 'inline', marginRight: 6 }} />
                      Audio
                    </div>
                    <div className={styles.trackList}>
                      {mediaConfig.tracks.map(track => (
                        <button 
                          key={track.language} 
                          className={`${styles.trackButton} ${currentAudio?.language === track.language ? styles.activeTrack : ''}`}
                          onClick={() => changeAudio(track)}
                        >
                          {track.label}
                          {currentAudio?.language === track.language && <Check size={16} className={styles.activeTrackIcon} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider if both exist */}
                {(mediaConfig?.tracks?.length ?? 0) > 1 && (mediaConfig?.subtitles?.length ?? 0) > 0 && (
                  <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />
                )}

                {/* Subtitles Section */}
                {mediaConfig?.subtitles && mediaConfig.subtitles.length > 0 && (
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>
                      <MessageSquare size={14} style={{ display: 'inline', marginRight: 6 }} />
                      Subtítulos
                    </div>
                    <div className={styles.trackList}>
                      <button 
                         className={`${styles.trackButton} ${!currentSubtitle ? styles.activeTrack : ''}`}
                         onClick={() => changeSubtitle(null)}
                      >
                        Desactivado
                        {!currentSubtitle && <Check size={16} className={styles.activeTrackIcon} />}
                      </button>
                      {mediaConfig.subtitles.map(track => (
                        <button 
                          key={track.language} 
                          className={`${styles.trackButton} ${currentSubtitle?.language === track.language ? styles.activeTrack : ''}`}
                          onClick={() => changeSubtitle(track)}
                        >
                          {track.label}
                          {currentSubtitle?.language === track.language && <Check size={16} className={styles.activeTrackIcon} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
