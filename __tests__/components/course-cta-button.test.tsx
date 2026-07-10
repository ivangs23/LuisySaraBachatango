// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import CourseCtaButton from '@/app/curso-bachatango/_components/CourseCtaButton'

describe('CourseCtaButton', () => {
  it('renderiza un link a /curso-bachatango/comprar con el courseId', () => {
    render(<CourseCtaButton courseId="c1" label="Comprar" />)
    expect(screen.getByRole('link', { name: 'Comprar' })).toHaveAttribute('href', '/curso-bachatango/comprar?courseId=c1')
  })
})
