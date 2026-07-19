'use client';

import { useState, useTransition } from 'react';
import { Comment, addComment, toggleLike } from '@/app/actions/comments';
import styles from './Comments.module.css';

// Mapeo de códigos máquina de las server actions a mensajes en español.
// Los mensajes ya legibles (p. ej. 'Debes iniciar sesión') pasan tal cual.
const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Estás comentando demasiado rápido. Espera un momento e inténtalo de nuevo.',
  rate_limit: 'Demasiadas acciones seguidas. Espera un momento e inténtalo de nuevo.',
  lesson_not_found: 'Esta lección ya no está disponible.',
  forbidden: 'No tienes acceso a este curso.',
  like_failed: 'No se pudo registrar el like. Inténtalo de nuevo.',
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? code;
}

type CommentItemProps = {
  comment: Comment;
  courseId: string; // Needed for revalidation context if improved later
  lessonId: string;
  onReplyAdded: () => void;
};

export default function CommentItem({ comment, courseId, lessonId, onReplyAdded }: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likes, setLikes] = useState(comment.likes_count);
  const [hasLiked, setHasLiked] = useState(comment.user_has_liked);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isLikePending, startLikeTransition] = useTransition();

  const handleLike = () => {
    if (isLikePending) return;
    // Optimistic update
    const newLikedState = !hasLiked;
    setHasLiked(newLikedState);
    setLikes(prev => newLikedState ? prev + 1 : prev - 1);

    startLikeTransition(async () => {
      const res = await toggleLike(comment.id);
      if (res && 'error' in res) {
        // Revertir el optimistic update si la acción falló
        setHasLiked(!newLikedState);
        setLikes(prev => newLikedState ? prev - 1 : prev + 1);
      }
    });
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    setReplyError(null);
    setIsSubmitting(true);
    const res = await addComment(lessonId, replyContent, comment.id);
    setIsSubmitting(false);

    if (res?.error) {
      setReplyError(errorMessage(res.error));
    } else {
      setReplyContent('');
      setIsReplying(false);
      onReplyAdded();
    }
  };

  return (
    <div className={styles.commentContainer}>
      <div className={styles.commentHeader}>
        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic host (Supabase storage or ui-avatars.com fallback); cannot use next/image without allowlisting all possible avatar providers */}
        <img
          src={comment.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.profiles?.full_name || 'User')}&background=random&rounded=true`}
          alt={comment.profiles?.full_name || 'User'}
          className={styles.avatar}
        />
        <div className={styles.userInfo}>
          <span className={styles.userName}>{comment.profiles?.full_name || 'Usuario'}</span>
          <span className={styles.date}>{new Date(comment.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className={styles.content}>
        <p>{comment.content}</p>
      </div>

      <div className={styles.actions}>
        <button
          onClick={handleLike}
          disabled={isLikePending}
          aria-pressed={hasLiked}
          className={`${styles.actionButton} ${hasLiked ? styles.liked : ''}`}
        >
          {hasLiked ? '❤️' : '🤍'} {likes}
        </button>
        <button onClick={() => setIsReplying(!isReplying)} className={styles.actionButton}>
          Responder
        </button>
      </div>

      {isReplying && (
        <form onSubmit={handleReplySubmit} className={styles.replyForm}>
          {replyError && (
            <p role="alert" className={styles.formError}>{replyError}</p>
          )}
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Escribe tu respuesta..."
            className={styles.input}
            rows={2}
          />
          <div className={styles.formActions}>
            <button type="button" onClick={() => setIsReplying(false)} className={styles.cancelButton}>Cancelar</button>
            <button type="submit" disabled={isSubmitting} className={styles.submitButton}>
              {isSubmitting ? (
                <>
                  <span className={styles.spinner}></span>
                  Enviando...
                </>
              ) : 'Responder'}
            </button>
          </div>
        </form>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className={styles.replies}>
          {comment.replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              courseId={courseId} 
              lessonId={lessonId}
              onReplyAdded={onReplyAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
