'use client';

import { useState, useTransition } from 'react';
import { gradeSubmission } from '@/app/courses/actions';

interface GradeSubmissionFormProps {
  submissionId: string;
  submittedUserId: string;
  courseId: string;
  lessonId: string;
  currentGrade: string | null;
  currentFeedback: string | null;
}

export default function GradeSubmissionForm({
  submissionId,
  submittedUserId,
  courseId,
  lessonId,
  currentGrade,
  currentFeedback,
}: GradeSubmissionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [grade, setGrade] = useState(currentGrade ?? '');
  const [feedback, setFeedback] = useState(currentFeedback ?? '');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    startTransition(async () => {
      const result = await gradeSubmission(
        submissionId,
        grade,
        feedback,
        courseId,
        lessonId,
        submittedUserId,
      );
      if (result?.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg('Corrección guardada y alumno notificado.');
        setIsOpen(false);
      }
    });
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {currentGrade ? 'Editar corrección' : 'Corregir'}
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Calificación (texto libre, ej: &quot;Muy bien&quot;, &quot;7/10&quot;)
            </label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Ej: Excelente trabajo"
              style={{
                width: '100%',
                background: '#111',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="Escribe aquí tus comentarios para el alumno..."
              style={{
                width: '100%',
                background: '#111',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {errorMsg && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: 0 }}>{errorMsg}</p>}
          {successMsg && <p style={{ color: '#4CAF50', fontSize: '0.85rem', margin: 0 }}>{successMsg}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '0.5rem 1.25rem',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Guardando...' : 'Guardar corrección'}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
