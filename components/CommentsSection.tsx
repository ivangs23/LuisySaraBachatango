'use client';

import { useState, useEffect, useCallback } from 'react';
import { getComments, addComment, Comment } from '@/app/actions/comments';
import CommentItem from './CommentItem';
import styles from './Comments.module.css';

type CommentsSectionProps = {
  lessonId: string;
  courseId: string; // Passed down for context if needed
};

export default function CommentsSection({ lessonId, courseId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await getComments(lessonId);
    if (data) {
      setComments(data);
    }
    setIsLoading(false);
  }, [lessonId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    const res = await addComment(lessonId, newComment);
    setIsSubmitting(false);

    if (res?.error) {
      alert(res.error);
    } else {
      setNewComment('');
      fetchComments();
    }
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>Comentarios</h3>
      
      <form onSubmit={handleSubmit} className={styles.mainForm}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Deja un comentario..."
          className={styles.mainInput}
          rows={3}
        />
        <button type="submit" disabled={isSubmitting} className={styles.mainSubmitButton}>
          {isSubmitting ? (
            <>
              <span className={styles.spinner}></span>
              Publicando...
            </>
          ) : 'Publicar Comentario'}
        </button>
      </form>

      <div className={styles.list}>
        {isLoading ? (
          <p>Cargando comentarios...</p>
        ) : comments.length > 0 ? (
          comments.map(comment => (
            <CommentItem 
              key={comment.id} 
              comment={comment} 
              courseId={courseId} 
              lessonId={lessonId}
              onReplyAdded={fetchComments}
            />
          ))
        ) : (
          <p className={styles.empty}>Sé el primero en comentar.</p>
        )}
      </div>
    </div>
  );
}
