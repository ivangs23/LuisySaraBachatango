// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminBanner from '@/components/admin/AdminBanner'

describe('AdminBanner', () => {
  it('renders link to /admin', () => {
    render(<AdminBanner />)
    const a = screen.getByRole('link', { name: /panel de administración/i })
    expect(a).toHaveAttribute('href', '/admin')
  })
})
