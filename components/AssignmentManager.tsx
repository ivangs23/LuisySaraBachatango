'use client';

import { useState, useTransition } from 'react';
import { createAssignment, updateAssignment, deleteAssignment } from '@/app/courses/actions';

type Assignment = {
  id: string;
  title: string;
  description: string | null;
} | null;

interface AssignmentManagerProps {
  lessonId: string;
  courseId: string;
  assignment: Assignment;
}

export default function AssignmentManager({ lessonId, courseId, assignment }: AssignmentManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(!assignment);
  const [title, setTitle] = useState(assignment?.title ?? '');
  const [description, setDescription] = useState(assignment?.description ?? '');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setErrorMsg('');
    setSuccessMsg('');

    startTransition(async () => {
      let result;
      if (assignment) {
        result = await updateAssignment(assignment.id, title, description, courseId, lessonId);
      } else {
        result = await createAssignment(lessonId, courseId, title, description);
      }

      if (result?.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg(assignment ? 'Tarea actualizada.' : 'Tarea creada.');
        setIsEditing(false);
      }
    });
  };

  const handleDelete = () => {
    if (!assignment) return;
    if (!confirm('¿Eliminar esta tarea? Se perderán todas las entregas.')) return;

    startTransition(async () => {
      const result = await deleteAssignment(assignment.id, courseId, lessonId);
      if (result?.error) {
        setErrorMsg(result.error);
      }
    });
  };

  return (
    <div style={{ marginTop: '2rem', borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>Tarea de la Lección</h3>
        {assignment && !isEditing && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a
              href={`/courses/${courseId}/${lessonId}/submissions`}
              style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none' }}
            >
              Ver entregas →
            </a>
            <button
              onClick={() => setIsEditing(true)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Editar
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {errorMsg && <p style={{ color: '#ff6b6b', fontSize: '0.9rem' }}>{errorMsg}</p>}
      {successMsg && <p style={{ color: '#4CAF50', fontSize: '0.9rem' }}>{successMsg}</p>}

      {assignment && !isEditing ? (
        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
          <p style={{ margin: '0 0 0.35rem', fontWeight: 600, color: '#fff' }}>{assignment.title}</p>
          {assignment.description && (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{assignment.description}</p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem', color: '#ccc' }}>Título de la tarea *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Ej: Practica los pasos de la clase"
              style={{
                width: '100%',
                background: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '0.6rem 0.75rem',
                color: '#fff',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.9rem', color: '#ccc' }}>Descripción / instrucciones</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe qué deben entregar los alumnos..."
              style={{
                width: '100%',
                background: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '0.6rem 0.75rem',
                color: '#fff',
                fontSize: '0.9rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              style={{
                padding: '0.6rem 1.25rem',
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
              {isPending ? 'Guardando...' : assignment ? 'Guardar cambios' : 'Crear tarea'}
            </button>
            {assignment && (
              <button
                type="button"
                onClick={() => { setIsEditing(false); setTitle(assignment.title); setDescription(assignment.description ?? ''); }}
                style={{ padding: '0.6rem 1rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
