'use client';

import { useState, useEffect, useCallback } from 'react';
import { getComments, addComment, Comment } from '@/app/actions/comments';
import CommentItem from './CommentItem';
import { useLanguage } from '@/context/LanguageContext';
import styles from './Comments.module.css';

// Mapeo de códigos máquina de las server actions a mensajes en español.
const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Estás comentando demasiado rápido. Espera un momento e inténtalo de nuevo.',
  lesson_not_found: 'Esta lección ya no está disponible.',
  forbidden: 'No tienes acceso a este curso.',
};

type CommentsSectionProps = {
  lessonId: string;
  courseId: string; // Passed down for context if needed
};

export default function CommentsSection({ lessonId, courseId }: CommentsSectionProps) {
  const { t } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const { data, error } = await getComments(lessonId);
      if (error) {
        setLoadError(true);
      } else if (data) {
        setComments(data);
        setLoadError(false);
      }
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    getComments(lessonId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setLoadError(true);
        else if (data) setComments(data);
        setIsLoading(false);
      })
      .catch(() => {
        // Sin este catch, un rechazo dejaría el "Cargando comentarios..." girando para siempre
        if (cancelled) return;
        setLoadError(true);
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [lessonId, retryKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitError(null);
    setIsSubmitting(true);
    const res = await addComment(lessonId, newComment);
    setIsSubmitting(false);

    if (res?.error) {
      setSubmitError(ERROR_MESSAGES[res.error] ?? res.error);
    } else {
      setNewComment('');
      fetchComments();
    }
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>{t.community.comments}</h3>

      <form onSubmit={handleSubmit} className={styles.mainForm}>
        {submitError && (
          <p role="alert" className={styles.formError}>{submitError}</p>
        )}
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t.community.commentPlaceholder}
          className={styles.mainInput}
          rows={3}
        />
        <button type="submit" disabled={isSubmitting} className={styles.mainSubmitButton}>
          {isSubmitting ? (
            <>
              <span className={styles.spinner}></span>
              {t.community.publishing}
            </>
          ) : t.community.publishComment}
        </button>
      </form>

      <div className={styles.list}>
        {isLoading ? (
          <p>{t.community.loadingComments}</p>
        ) : loadError ? (
          <div className={styles.loadError}>
            <p role="alert" className={styles.formError}>
              {t.community.loadError}
            </p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => setRetryKey(k => k + 1)}
            >
              {t.community.retry}
            </button>
          </div>
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
          <p className={styles.empty}>{t.community.firstToComment}</p>
        )}
      </div>
    </div>
  );
}
