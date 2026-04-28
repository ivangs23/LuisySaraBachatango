// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'es',
    setLocale: () => {},
    t: { lesson: { previousLesson: 'Anterior', nextLesson: 'Siguiente', lessonNavigation: 'Navegación entre lecciones' } },
  }),
}))

import LessonNavigation from '@/components/LessonNavigation'

const prev = { id: 'lesson-a', title: 'Pasos básicos', displayNumber: '2.1' }
const next = { id: 'lesson-b', title: 'Vuelta sencilla', displayNumber: '2.3' }

describe('LessonNavigation', () => {
  it('renders both prev and next links with correct hrefs and titles', () => {
    render(<LessonNavigation courseId="course-1" prev={prev} next={next} />)
    const prevLink = screen.getByRole('link', { name: /anterior/i })
    const nextLink = screen.getByRole('link', { name: /siguiente/i })
    expect(prevLink).toHaveAttribute('href', '/courses/course-1/lesson-a')
    expect(nextLink).toHaveAttribute('href', '/courses/course-1/lesson-b')
    expect(screen.getByText('Pasos básicos')).toBeInTheDocument()
    expect(screen.getByText('Vuelta sencilla')).toBeInTheDocument()
    expect(screen.getByText('2.1')).toBeInTheDocument()
    expect(screen.getByText('2.3')).toBeInTheDocument()
  })

  it('renders only the next link when prev is null', () => {
    render(<LessonNavigation courseId="course-1" prev={null} next={next} />)
    expect(screen.queryByRole('link', { name: /anterior/i })).toBeNull()
    expect(screen.getByRole('link', { name: /siguiente/i })).toHaveAttribute(
      'href',
      '/courses/course-1/lesson-b',
    )
  })

  it('renders only the prev link when next is null', () => {
    render(<LessonNavigation courseId="course-1" prev={prev} next={null} />)
    expect(screen.queryByRole('link', { name: /siguiente/i })).toBeNull()
    expect(screen.getByRole('link', { name: /anterior/i })).toHaveAttribute(
      'href',
      '/courses/course-1/lesson-a',
    )
  })

  it('renders nothing when both prev and next are null', () => {
    const { container } = render(
      <LessonNavigation courseId="course-1" prev={null} next={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
