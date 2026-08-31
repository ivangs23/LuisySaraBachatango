// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))
import { render, screen, within } from '@testing-library/react'
import CourseCurriculum from '@/app/curso-bachatango/_components/CourseCurriculum'
import type { Curriculum } from '@/utils/courses/curriculum'

const CURRICULUM: Curriculum = {
  moduleCount: 2,
  lessonCount: 3,
  totalSeconds: 5400,
  modules: [
    { id: 'm1', title: 'INTRODUCCIÓN', order: 1, lessons: [], totalSeconds: 1800 },
    {
      id: 'm2',
      title: 'POSTURAS',
      order: 2,
      totalSeconds: 3600,
      lessons: [{ id: 's1', title: 'Práctica guiada', duration: 600 }],
    },
  ],
}

describe('CourseCurriculum', () => {
  it('lista todos los módulos con su número', () => {
    render(<CourseCurriculum curriculum={CURRICULUM} />)
    expect(screen.getByText('INTRODUCCIÓN')).toBeInTheDocument()
    expect(screen.getByText('POSTURAS')).toBeInTheDocument()
  })

  it('resume módulos, lecciones y duración total', () => {
    render(<CourseCurriculum curriculum={CURRICULUM} />)
    expect(screen.getByText(/2 módulos/)).toBeInTheDocument()
    expect(screen.getByText(/3 lecciones/)).toBeInTheDocument()
    expect(screen.getByText(/1 h 30 min/)).toBeInTheDocument()
  })

  it('muestra las sublecciones de un módulo', () => {
    render(<CourseCurriculum curriculum={CURRICULUM} />)
    expect(screen.getByText('Práctica guiada')).toBeInTheDocument()
  })

  it('renderiza un h2 accesible', () => {
    render(<CourseCurriculum curriculum={CURRICULUM} />)
    expect(screen.getByRole('heading', { level: 2, name: /qué vas a aprender/i })).toBeInTheDocument()
  })

  it('omite la duración de un módulo que no la tiene', () => {
    const sinDuracion: Curriculum = {
      ...CURRICULUM,
      modules: [{ id: 'm1', title: 'SOLO TÍTULO', order: 1, lessons: [], totalSeconds: 0 }],
    }
    render(<CourseCurriculum curriculum={sinDuracion} />)
    const item = screen.getByText('SOLO TÍTULO').closest('li')!
    expect(within(item).queryByText(/min|h /)).toBeNull()
  })
})
