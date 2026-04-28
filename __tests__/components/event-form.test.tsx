// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/app/events/actions', () => ({
  createEvent: vi.fn().mockResolvedValue(undefined),
  updateEvent: vi.fn().mockResolvedValue(undefined),
}))

import EventForm from '@/components/EventForm'
import { createEvent, updateEvent } from '@/app/events/actions'

beforeEach(() => vi.clearAllMocks())

const baseInitial = {
  id: 'evt-1',
  start_date: '2026-07-01',
  end_date: '2026-07-03',
  location: 'Madrid, España',
  is_published: true,
  title: { es: 'T es', en: '', fr: '', de: '', it: '', ja: '' },
  description: { es: 'D es', en: '', fr: '', de: '', it: '', ja: '' },
}

describe('EventForm', () => {
  it('renders empty fields when no initialData (create mode)', () => {
    render(<EventForm />)
    expect((screen.getByLabelText('Ubicación') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Título Español') as HTMLInputElement).value).toBe('')
  })

  it('renders prefilled fields when initialData is provided (edit mode)', () => {
    render(<EventForm initialData={baseInitial} />)
    expect((screen.getByLabelText('Ubicación') as HTMLInputElement).value).toBe('Madrid, España')
    expect((screen.getByLabelText('Título Español') as HTMLInputElement).value).toBe('T es')
  })

  it('shows the per-locale completeness dot — complete when both title+description are filled, empty otherwise', () => {
    render(<EventForm initialData={baseInitial} />)
    const esTab = screen.getByRole('tab', { name: /Español/ })
    const enTab = screen.getByRole('tab', { name: /English/ })
    expect(esTab.querySelector('[data-state="complete"]')).not.toBeNull()
    expect(enTab.querySelector('[data-state="empty"]')).not.toBeNull()
  })

  it('blocks submission and shows an error when title_es is empty', async () => {
    render(<EventForm />)
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'Sevilla' } })
    fireEvent.change(screen.getByLabelText('Descripción Español'), { target: { value: 'desc' } })
    // title_es left empty
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar' }).closest('form')!)
    expect(await screen.findByText('El título en español es obligatorio')).toBeInTheDocument()
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('blocks submission when end_date < start_date', async () => {
    render(<EventForm initialData={baseInitial} />)
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-06-01' } })
    fireEvent.submit(screen.getByLabelText('Fecha de fin').closest('form')!)
    expect(
      await screen.findByText('La fecha de fin debe ser igual o posterior a la de inicio'),
    ).toBeInTheDocument()
    expect(updateEvent).not.toHaveBeenCalled()
  })

  it('calls createEvent with FormData when create-mode submit succeeds', async () => {
    render(<EventForm />)
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-08-02' } })
    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'Sevilla' } })
    fireEvent.change(screen.getByLabelText('Título Español'), { target: { value: 'Nuevo' } })
    fireEvent.change(screen.getByLabelText('Descripción Español'), { target: { value: 'Desc' } })
    fireEvent.submit(screen.getByLabelText('Ubicación').closest('form')!)

    await vi.waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1))
    const fd = (createEvent as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as FormData
    expect(fd.get('title_es')).toBe('Nuevo')
  })
})
