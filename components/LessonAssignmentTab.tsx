'use client';

import { useState, useTransition } from 'react';
import { submitAssignment, uploadAssignmentFile } from '@/app/courses/actions';
import { useLanguage } from '@/context/LanguageContext';

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

interface LessonAssignmentTabProps {
  assignment: Assignment | null;
  submission: Submission | null;
  isAdmin: boolean;
  courseId: string;
  lessonId: string;
}

export default function LessonAssignmentTab({
  assignment,
  submission,
  isAdmin,
  courseId,
  lessonId,
}: LessonAssignmentTabProps) {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [textContent, setTextContent] = useState(submission?.text_content ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!assignment) {
    return (
      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
        {isAdmin ? t.lesson.assignmentNoTaskAdmin : t.lesson.assignmentNoTask}
      </div>
    );
  }

  const hasSubmitted = !!submission;
  const isReviewed = submission?.status === 'reviewed';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    let fileUrl: string | null = null;

    if (file) {
      setUploading(true);
      const result = await uploadAssignmentFile(assignment.id, file);
      setUploading(false);
      if (result.error || !result.fileUrl) {
        setErrorMsg(result.error ?? 'upload_failed');
        return;
      }
      fileUrl = result.fileUrl;
    }

    startTransition(async () => {
      const result = await submitAssignment(assignment.id, textContent, fileUrl ?? submission?.file_url ?? null);
      if (result?.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg(t.lesson.assignmentSuccess);
      }
    });
  };

  return (
    <div style={{ padding: '1rem 0' }}>
      {/* Assignment prompt */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>{assignment.title}</h3>
        {assignment.description && (
          <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>{assignment.description}</p>
        )}
      </div>

      {/* Submission feedback (if reviewed) */}
      {isReviewed && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(76,175,80,0.08)', borderRadius: '8px', border: '1px solid rgba(76,175,80,0.3)' }}>
          <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#4CAF50', fontSize: '0.9rem' }}>{t.lesson.assignmentReviewed}</p>
          {submission?.grade && <p style={{ margin: '0.25rem 0', color: 'var(--text-main)' }}>{t.lesson.assignmentGradeLabel} <strong>{submission.grade}</strong></p>}
          {submission?.feedback && <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)' }}>{submission.feedback}</p>}
        </div>
      )}

      {/* Submission form — editable until reviewed */}
      {!isReviewed && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {t.lesson.assignmentResponseLabel}
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                background: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '0.75rem',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              placeholder={t.lesson.assignmentResponsePlaceholder}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {t.lesson.assignmentFileLabel}
            </label>
            {hasSubmitted && submission?.file_url && !file && (
              <p style={{ fontSize: '0.8rem', color: '#4CAF50', marginBottom: '0.4rem' }}>
                ✓ Archivo actual: {submission.file_url.split('/').pop()}
              </p>
            )}
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}
            />
          </div>

          {errorMsg && <p style={{ color: '#ff6b6b', fontSize: '0.9rem', margin: 0 }}>{errorMsg}</p>}
          {successMsg && <p style={{ color: '#4CAF50', fontSize: '0.9rem', margin: 0 }}>{successMsg}</p>}

          <button
            type="submit"
            disabled={isPending || uploading || (!textContent.trim() && !file && !submission?.file_url)}
            style={{
              alignSelf: 'flex-start',
              padding: '0.65rem 1.5rem',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: (isPending || uploading) ? 0.7 : 1,
            }}
          >
            {uploading ? t.lesson.assignmentUploading : isPending ? t.lesson.assignmentSending : hasSubmitted ? t.lesson.assignmentUpdateBtn : t.lesson.assignmentSubmitBtn}
          </button>
        </form>
      )}

      {isReviewed && isAdmin && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <a href={`/courses/${courseId}/${lessonId}/submissions`} style={{ color: 'var(--primary)' }}>{t.lesson.assignmentViewSubmissions}</a>
        </p>
      )}
    </div>
  );
}
