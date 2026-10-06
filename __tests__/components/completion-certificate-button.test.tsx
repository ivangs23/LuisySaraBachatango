// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockIssue, mockPush } = vi.hoisted(() => ({
  mockIssue: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))
vi.mock('@/app/courses/completion-actions', () => ({
  issueCompletion: (...args: unknown[]) => mockIssue(...args),
}))

import { LanguageProvider } from '@/context/LanguageContext'
import CompletionCertificateButton from '@/components/CompletionCertificateButton'

function renderButton(props: Partial<React.ComponentProps<typeof CompletionCertificateButton>> = {}) {
  return render(
    <LanguageProvider initialLocale="es">
      <CompletionCertificateButton
        courseId="c1"
        lessonCount={10}
        completedCount={10}
        alreadyIssued={false}
        defaultName="Sara García"
        {...props}
      />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIssue.mockResolvedValue({ ok: true, alreadyIssued: false })
})

describe('CompletionCertificateButton — el gate del 100 %', () => {
  it('está deshabilitado y dice cuántas lecciones faltan', () => {
    renderButton({ completedCount: 8 })
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('Te faltan 2 lecciones por completar')).toBeInTheDocument()
  })

  it('usa el singular cuando falta una sola', () => {
    renderButton({ completedCount: 9 })
    expect(screen.getByText('Te falta 1 lección por completar')).toBeInTheDocument()
  })

  it('sigue bloqueado en un curso sin lecciones, aunque 0 de 0 sea "todo"', () => {
    renderButton({ lessonCount: 0, completedCount: 0 })
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('se habilita al completar todas', () => {
    renderButton()
    const button = screen.getByRole('button', { name: /Obtener mi certificado/i })
    expect(button).toBeEnabled()
  })
})

describe('CompletionCertificateButton — emisión', () => {
  it('pide el nombre prerrellenado antes de emitir', async () => {
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: /Obtener mi certificado/i }))

    const input = screen.getByLabelText('Nombre completo')
    expect(input).toHaveValue('Sara García')
    expect(screen.getByText(/no podrá cambiarse después/i)).toBeInTheDocument()
  })

  it('manda el nombre saneado y navega al documento', async () => {
    const user = userEvent.setup()
    renderButton({ defaultName: '' })
    await user.click(screen.getByRole('button', { name: /Obtener mi certificado/i }))
    await user.type(screen.getByLabelText('Nombre completo'), '  luis   montero  ')
    await user.click(screen.getByRole('button', { name: /^Emitir certificado$/i }))

    expect(mockIssue).toHaveBeenCalledWith('c1', 'luis montero')
    expect(mockPush).toHaveBeenCalledWith('/courses/c1/certificado')
  })

  it('no llama al servidor si el nombre no es un nombre', async () => {
    const user = userEvent.setup()
    renderButton({ defaultName: '' })
    await user.click(screen.getByRole('button', { name: /Obtener mi certificado/i }))
    await user.type(screen.getByLabelText('Nombre completo'), '42')
    await user.click(screen.getByRole('button', { name: /^Emitir certificado$/i }))

    expect(mockIssue).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe tu nombre completo.')
  })

  it('traduce el rechazo del servidor y no navega', async () => {
    mockIssue.mockResolvedValue({ ok: false, error: 'incomplete', remaining: 1 })
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: /Obtener mi certificado/i }))
    await user.click(screen.getByRole('button', { name: /^Emitir certificado$/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('Todavía no has completado todas las lecciones.')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('si ya está emitido enlaza al documento sin volver a pedir nada', () => {
    renderButton({ alreadyIssued: true })
    const link = screen.getByRole('link', { name: /Ver mi certificado/i })
    expect(link).toHaveAttribute('href', '/courses/c1/certificado')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
