// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
// El héroe monta CompletionCertificateButton, que importa el server action del
// certificado; su cadena de imports toca `server-only`, que revienta fuera de
// un Server Component. Mismo apaño que en __tests__/utils/curriculum.test.ts.
vi.mock('server-only', () => ({}))

import { LanguageProvider } from '@/context/LanguageContext'
import CourseDetailView from '@/components/CourseDetailView'

const COURSE = {
  id: 'c1',
  title: 'Curso Bachatango',
  description: null,
  image_url: null,
  month: null,
  year: null,
  course_type: 'complete' as const,
  category: null,
  price_eur: 129,
}

/** Lo que la RLS deja ver a quien no ha comprado: solo las gratuitas. */
const VISIBLES = [
  { id: 'l1', title: 'Clase de muestra', order: 1, release_date: '2026-01-01', parent_lesson_id: null },
]

function renderView(props: Partial<React.ComponentProps<typeof CourseDetailView>> = {}) {
  return render(
    <LanguageProvider initialLocale="es">
      <CourseDetailView
        course={COURSE}
        lessons={VISIBLES}
        lessonCount={24}
        hasAccess={false}
        isAdmin={false}
        completedLessonIds={[]}
        certificateIssued={false}
        fullName=""
        {...props}
      />
    </LanguageProvider>,
  )
}

/**
 * La RLS filtra `lessons` a las gratuitas para quien no ha comprado, y el héroe
 * pintaba `lessons.length` fuera del gate de acceso: la página de venta
 * anunciaba «0 LECCIONES» justo encima del precio y del botón de comprar.
 *
 * Peor aún, /curso-bachatango mostraba el número correcto del mismo curso
 * porque su temario se lee con el service role. Dos páginas, un producto,
 * datos contradictorios.
 */
describe('CourseDetailView — número de lecciones', () => {
  it('anuncia el total real del curso, no lo que la RLS deja ver', () => {
    renderView()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText(/LECCIONES/)).toBeInTheDocument()
  })

  it('nunca dice «0 LECCIONES» a quien todavía no ha comprado', () => {
    renderView({ lessons: [], lessonCount: 24 })
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('usa el singular cuando el curso tiene una sola lección', () => {
    renderView({ lessonCount: 1 })
    expect(screen.getByText(/LECCIÓN$/)).toBeInTheDocument()
  })

  it('el progreso sigue contando solo lo que el alumno ve', () => {
    renderView({ hasAccess: true, lessons: VISIBLES, lessonCount: 24, completedLessonIds: ['l1'] })
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })
})
