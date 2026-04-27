// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StudentsTable from '@/components/admin/StudentsTable'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/admin/alumnos',
}))

describe('StudentsTable', () => {
  it('renders one row per student', () => {
    const rows = [
      { id: 'a', full_name: 'Ana', email: 'ana@x.com', avatar_url: null,
        role: 'member' as const, created_at: '2026-04-01T00:00:00Z',
        lastActivity: '2026-04-25T00:00:00Z', subPlan: null, subPeriodEnd: null },
      { id: 'b', full_name: 'Bob', email: 'b@x.com', avatar_url: null,
        role: 'admin' as const, created_at: '2026-04-02T00:00:00Z',
        lastActivity: '2026-04-26T00:00:00Z', subPlan: '6months', subPeriodEnd: '2026-10-02T00:00:00Z' },
    ]
    render(<StudentsTable rows={rows} sort="created" />)
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('navigates on row click', () => {
    const rows = [{
      id: 'a', full_name: 'Ana', email: 'ana@x.com', avatar_url: null,
      role: 'member' as const, created_at: '2026-04-01T00:00:00Z',
      lastActivity: '2026-04-25T00:00:00Z', subPlan: null, subPeriodEnd: null,
    }]
    render(<StudentsTable rows={rows} sort="created" />)
    fireEvent.click(screen.getByText('Ana').closest('tr')!)
    expect(push).toHaveBeenCalledWith('/admin/alumnos/a')
  })
})
