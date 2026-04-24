'use client'

import { useState, useTransition } from 'react'
import { togglePostLike } from '@/app/actions/community-likes'
import styles from './PostLikeButton.module.css'

type Props = {
  postId: string
  initialLiked: boolean
  initialCount: number
}

export default function PostLikeButton({ postId, initialLiked, initialCount }: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    const next = !liked
    setLiked(next)
    setCount(c => c + (next ? 1 : -1))
    startTransition(async () => {
      const res = await togglePostLike(postId)
      if (!res.success) {
        // revert on error
        setLiked(!next)
        setCount(c => c - (next ? 1 : -1))
      }
    })
  }

  return (
    <button
      type="button"
      className={`${styles.btn} ${liked ? styles.liked : ''}`}
      onClick={handleClick}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? 'Quitar like' : 'Dar like'}
    >
      <span aria-hidden>{liked ? '♥' : '♡'}</span>
      <span className={styles.count}>{count}</span>
    </button>
  )
}
