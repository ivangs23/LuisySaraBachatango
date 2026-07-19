'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ClipboardList, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { submitAssignment } from '@/app/courses/actions';
import { useLanguage } from '@/context/LanguageContext';
import styles from './AssignmentPanel.module.css';

type Assignment = {
  id: string;
  title: string;
  description: string | null;
};

type Submission = {
  id?: string;
  text_content: string | null;
  file_url: string | null;
  status: string;
  grade: string | null;
  feedback: string | null;
};

type Props = {
  courseId: string;
  lessonId: string;
  assignment: Assignment | null;
  submission: Submission | null;
  isAdmin: boolean;
};

export default function AssignmentPanel({ courseId, lessonId, assignment, submission, isAdmin }: Props) {
  const { t } = useLanguage();
  const l = t.lesson;

  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState(submission?.text_content ?? '');
  const [url, setUrl] = useState(submission?.file_url ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  // Estado local que refleja la última entrega conocida tras enviar, para no
  // depender de un refetch del servidor. Se inicializa desde el prop; el
  // componente se remonta al navegar entre lecciones (server component padre),
  // así que no hace falta resincronizar por efecto.
  const [current, setCurrent] = useState<Submission | null>(submission);

  // Sin tarea: mensaje según rol.
  if (!assignment) {
    return (
      <div className={styles.placeholder}>
        <ClipboardList size={22} strokeWidth={1.6} aria-hidden="true" />
        <p>{isAdmin ? l.assignmentNoTaskAdmin : l.assignmentNoTask}</p>
      </div>
    );
  }

  const isReviewed = current?.status === 'reviewed';
  const isSubmitted = !!current && !isReviewed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    startTransition(async () => {
      const res = await submitAssignment(assignment.id, text.trim(), url.trim() || null);
      if (res?.error) {
        // Mapear el único código específico útil; el resto → mensaje genérico.
        setError(res.error === 'invalid_file' ? l.assignmentUrlLabel : l.assignmentError);
        return;
      }
      setSuccess(true);
      setCurrent({
        text_content: text.trim() || null,
        file_url: url.trim() || null,
        status: 'pending',
        grade: null,
        feedback: null,
      });
    });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h3 className={styles.title}>{assignment.title}</h3>
        {assignment.description && <p className={styles.desc}>{assignment.description}</p>}
      </div>

      {/* Admin: no entrega; enlace a la bandeja de correcciones. */}
      {isAdmin ? (
        <Link href={`/courses/${courseId}/${lessonId}/submissions`} className={styles.adminLink}>
          <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
          {l.assignmentViewSubmissions}
        </Link>
      ) : isReviewed ? (
        <div className={styles.reviewed} role="status">
          <p className={styles.reviewedHead}>
            <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" />
            {l.assignmentReviewed}
          </p>
          {current?.grade && (
            <p className={styles.grade}>
              <span className={styles.gradeLabel}>{l.assignmentGradeLabel}</span> {current.grade}
            </p>
          )}
          {current?.feedback && (
            <div className={styles.feedback}>
              <span className={styles.feedbackLabel}>{l.assignmentFeedbackLabel}</span>
              <p>{current.feedback}</p>
            </div>
          )}
          {current?.text_content && <p className={styles.ownAnswer}>{current.text_content}</p>}
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          {isSubmitted && (
            <p className={styles.inReview} role="status">
              <Clock size={15} strokeWidth={2} aria-hidden="true" />
              {l.assignmentInReview}
            </p>
          )}

          <label className={styles.field}>
            <span className={styles.label}>{l.assignmentResponseLabel}</span>
            <textarea
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={l.assignmentResponsePlaceholder}
              rows={5}
              disabled={isPending}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{l.assignmentUrlLabel}</span>
            <input
              type="url"
              className={styles.input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={l.assignmentUrlPlaceholder}
              disabled={isPending}
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">{error}</p>
          )}
          {success && (
            <p className={styles.success} role="status">{l.assignmentSuccess}</p>
          )}

          <button
            type="submit"
            className={styles.submit}
            disabled={isPending || (!text.trim() && !url.trim())}
            aria-busy={isPending}
          >
            {isPending ? l.assignmentSending : isSubmitted ? l.assignmentUpdateBtn : l.assignmentSubmitBtn}
          </button>
        </form>
      )}
    </div>
  );
}
