// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import AdminKpiCard from '@/components/admin/AdminKpiCard'

describe('AdminKpiCard', () => {
  it('renders label, value and sub', () => {
    render(<AdminKpiCard label="Alumnos" value="42" sub="+3 esta semana" Icon={Users} />)
    expect(screen.getByText('Alumnos')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('+3 esta semana')).toBeInTheDocument()
  })

  it('does not render sub when not provided', () => {
    const { container } = render(<AdminKpiCard label="X" value="0" Icon={Users} />)
    expect(container.querySelector('[data-slot="sub"]')).toBeNull()
  })
})
