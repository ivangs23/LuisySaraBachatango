// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/courses/actions', () => ({ createCourse: vi.fn(), updateCourse: vi.fn() }))

import CourseForm from '@/components/CourseForm'

// El tachado y las plazas se encienden desde este formulario. La advertencia
// legal va pegada a cada campo, y enlazada con aria-describedby para que la
// lea también un lector de pantalla.
describe('CourseForm · advertencias de la oferta', () => {
  it('el precio tachado avisa de que debe ser el más bajo de los últimos 30 días', () => {
    render(<CourseForm />)
    expect(screen.getByLabelText('Precio antes de la oferta (€)')).toHaveAccessibleDescription(
      /^Solo si es el precio más bajo que habéis cobrado en los últimos 30 días\./,
    )
  })

  it('las plazas avisan de que solo valen con un límite real', () => {
    render(<CourseForm />)
    expect(screen.getByLabelText('Plazas disponibles')).toHaveAccessibleDescription(
      /^Solo si hay un límite real de alumnos\./,
    )
  })
})
