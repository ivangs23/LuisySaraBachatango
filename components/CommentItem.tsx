'use client';

import { useState } from 'react';
import { Comment, addComment, toggleLike } from '@/app/actions/comments';
import styles from './Comments.module.css';

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

  const handleLike = async () => {
    // Optimistic update
    const newLikedState = !hasLiked;
    setHasLiked(newLikedState);
    setLikes(prev => newLikedState ? prev + 1 : prev - 1);

    await toggleLike(comment.id);
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    const res = await addComment(lessonId, replyContent, comment.id);
    setIsSubmitting(false);

    if (res?.error) {
      alert(res.error);
    } else {
      setReplyContent('');
      setIsReplying(false);
      onReplyAdded();
    }
  };

  return (
    <div className={styles.commentContainer}>
      <div className={styles.commentHeader}>
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
