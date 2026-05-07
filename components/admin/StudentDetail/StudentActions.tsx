'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateUserRole, grantCourseAccess, sendNotification, deleteUser,
} from '@/app/admin/alumnos/actions'
import styles from './StudentDetail.module.css'

type Course = { id: string; title: string }
type Props = { userId: string; userEmail: string | null; currentRole: 'member' | 'premium' | 'admin'; courses: Course[] }

type Modal = 'none' | 'role' | 'grant' | 'notify' | 'delete'

export default function StudentActions({ userId, userEmail, currentRole, courses }: Props) {
  const [modal, setModal] = useState<Modal>('none')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const isOpen = modal !== 'none'

  function close() { setModal('none'); setError(null) }

  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement as HTMLElement

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try { await fn(); close(); router.refresh() }
      catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    })
  }

  return (
    <section className={styles.summaryBlock}>
      <h3>Acciones</h3>
      <div className={styles.actionsCol}>
        <button className={styles.actionLine} onClick={() => setModal('role')}>Cambiar rol</button>
        <button className={styles.actionLine} onClick={() => setModal('grant')}>+ Conceder acceso a curso</button>
        <button className={styles.actionLine} onClick={() => setModal('notify')}>✉ Enviar notificación</button>
        <button className={`${styles.actionLine} ${styles.actionDanger}`} onClick={() => setModal('delete')}>⚠ Eliminar alumno</button>
      </div>

      {modal !== 'none' && (
        <div className={styles.modalBackdrop} onClick={close}>
          <div
            ref={dialogRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-actions-dialog-title"
            onClick={e => e.stopPropagation()}
          >
            {modal === 'role' && (
              <RoleForm
                currentRole={currentRole}
                disabled={isPending}
                onSubmit={(role) => run(() => updateUserRole(userId, role))}
                error={error}
              />
            )}
            {modal === 'grant' && (
              <GrantForm
                courses={courses}
                disabled={isPending}
                onSubmit={(cid) => run(() => grantCourseAccess(userId, cid))}
                error={error}
              />
            )}
            {modal === 'notify' && (
              <NotifyForm
                disabled={isPending}
                onSubmit={(t, b) => run(() => sendNotification(userId, t, b))}
                error={error}
              />
            )}
            {modal === 'delete' && (
              <DeleteForm
                disabled={isPending}
                targetEmail={userEmail}
                onSubmit={(p, e) => run(() => deleteUser(userId, p, e))}
                error={error}
              />
            )}
            <button className={styles.modalClose} onClick={close} aria-label="Cerrar">✕</button>
          </div>
        </div>
      )}
    </section>
  )
}

function RoleForm({ currentRole, disabled, error, onSubmit }: {
  currentRole: 'member' | 'premium' | 'admin'; disabled: boolean; error: string | null
  onSubmit: (r: 'member' | 'premium' | 'admin') => void
}) {
  const [r, setR] = useState(currentRole)
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(r) }}>
      <h3 id="student-actions-dialog-title">Cambiar rol</h3>
      <select value={r} onChange={e => setR(e.target.value as never)} disabled={disabled} className={styles.input}>
        <option value="member">member</option>
        <option value="premium">premium</option>
        <option value="admin">admin</option>
      </select>
      {error && <p className={styles.errorMsg}>{error}</p>}
      <button type="submit" disabled={disabled} className={styles.btnPrimary}>Guardar</button>
    </form>
  )
}

function GrantForm({ courses, disabled, error, onSubmit }: {
  courses: Course[]; disabled: boolean; error: string | null; onSubmit: (id: string) => void
}) {
  const [cid, setCid] = useState(courses[0]?.id ?? '')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (cid) onSubmit(cid) }}>
      <h3 id="student-actions-dialog-title">Conceder acceso a curso</h3>
      <select value={cid} onChange={e => setCid(e.target.value)} disabled={disabled} className={styles.input}>
        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      {error && <p className={styles.errorMsg}>{error}</p>}
      <button type="submit" disabled={disabled || !cid} className={styles.btnPrimary}>Conceder</button>
    </form>
  )
}

function NotifyForm({ disabled, error, onSubmit }: {
  disabled: boolean; error: string | null; onSubmit: (title: string, body: string) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(title, body) }}>
      <h3 id="student-actions-dialog-title">Enviar notificación</h3>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título" disabled={disabled} className={styles.input} />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Mensaje" rows={4} disabled={disabled} className={styles.input} />
      {error && <p className={styles.errorMsg}>{error}</p>}
      <button type="submit" disabled={disabled || !title.trim()} className={styles.btnPrimary}>Enviar</button>
    </form>
  )
}

function DeleteForm({ disabled, error, targetEmail, onSubmit }: {
  disabled: boolean; error: string | null; targetEmail: string | null
  onSubmit: (phrase: string, email: string) => void
}) {
  const [phrase, setPhrase] = useState('')
  const [typedEmail, setTypedEmail] = useState('')
  const emailMatch = typedEmail.trim().toLowerCase() === (targetEmail ?? '').toLowerCase()
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(phrase, typedEmail) }}>
      <h3 id="student-actions-dialog-title">Eliminar alumno</h3>
      <p>Esta acción es <strong>irreversible</strong>. Escribe <code>ELIMINAR</code> para confirmar.</p>
      <input value={phrase} onChange={e => setPhrase(e.target.value)} disabled={disabled} className={styles.input} />
      <p>
        Para confirmar, escribe el email del usuario:{' '}
        <strong>{targetEmail ?? '(sin email)'}</strong>
      </p>
      <input
        type="email"
        value={typedEmail}
        onChange={e => setTypedEmail(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        placeholder="email@ejemplo.com"
        className={styles.input}
      />
      {error && <p className={styles.errorMsg}>{error}</p>}
      <button type="submit" disabled={disabled || phrase !== 'ELIMINAR' || !emailMatch} className={styles.btnDanger}>
        Eliminar definitivamente
      </button>
    </form>
  )
}
