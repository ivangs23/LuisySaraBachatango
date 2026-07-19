// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'
import AssignmentPanel from '@/components/AssignmentPanel'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const mockSubmit = vi.fn()
vi.mock('@/app/courses/actions', () => ({
  submitAssignment: (...a: unknown[]) => mockSubmit(...a),
}))

const wrap = (ui: React.ReactElement) =>
  render(<LanguageProvider initialLocale="es">{ui}</LanguageProvider>)

const assignment = { id: 'a1', title: 'Practica el paso básico', description: 'Graba un vídeo.' }

beforeEach(() => {
  vi.clearAllMocks()
  mockSubmit.mockResolvedValue({ success: true })
})

describe('AssignmentPanel', () => {
  it('sin tarea (alumno): muestra el mensaje de "sin tarea"', () => {
    wrap(<AssignmentPanel courseId="c1" lessonId="l1" assignment={null} submission={null} isAdmin={false} />)
    expect(screen.getByText(/no ha asignado ninguna tarea/i)).toBeInTheDocument()
  })

  it('admin: muestra el enlace a la bandeja de entregas, no el formulario', () => {
    wrap(<AssignmentPanel courseId="c1" lessonId="l1" assignment={assignment} submission={null} isAdmin={true} />)
    const link = screen.getByRole('link', { name: /entregas/i })
    expect(link).toHaveAttribute('href', '/courses/c1/l1/submissions')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('alumno sin entrega: envía la tarea llamando a submitAssignment', async () => {
    wrap(<AssignmentPanel courseId="c1" lessonId="l1" assignment={assignment} submission={null} isAdmin={false} />)
    const textarea = screen.getByLabelText(/tu respuesta/i)
    fireEvent.change(textarea, { target: { value: 'Hecho' } })
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('a1', 'Hecho', null))
    expect(await screen.findByText(/entrega enviada/i)).toBeInTheDocument()
  })

  it('alumno con entrega pendiente: muestra "en revisión" y permite actualizar', () => {
    const submission = { text_content: 'v1', file_url: null, status: 'pending', grade: null, feedback: null }
    wrap(<AssignmentPanel courseId="c1" lessonId="l1" assignment={assignment} submission={submission} isAdmin={false} />)
    expect(screen.getByText(/en revisión/i)).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent(/actualizar/i)
  })

  it('entrega corregida: muestra nota y feedback, sin formulario', () => {
    const submission = { text_content: 'v1', file_url: null, status: 'reviewed', grade: '9', feedback: '¡Muy bien!' }
    wrap(<AssignmentPanel courseId="c1" lessonId="l1" assignment={assignment} submission={submission} isAdmin={false} />)
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText(/muy bien/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('error del servidor: muestra un mensaje role=alert', async () => {
    mockSubmit.mockResolvedValue({ error: 'boom' })
    wrap(<AssignmentPanel courseId="c1" lessonId="l1" assignment={assignment} submission={null} isAdmin={false} />)
    fireEvent.change(screen.getByLabelText(/tu respuesta/i), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
