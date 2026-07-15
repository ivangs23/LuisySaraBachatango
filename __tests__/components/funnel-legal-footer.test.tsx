// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

let mockPath = '/'
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }))

import FunnelLegalFooter from '@/components/FunnelLegalFooter'

describe('FunnelLegalFooter', () => {
  it.each(['/curso-bachatango', '/curso-bachatango/comprar', '/gracias'])(
    'renders the legal links on funnel route %s',
    (path) => {
      mockPath = path
      const { container } = render(<FunnelLegalFooter />)
      for (const href of ['/legal/notice', '/legal/privacy', '/legal/cookies', '/legal/terms']) {
        expect(container.querySelector(`a[href="${href}"]`)).toBeTruthy()
      }
    },
  )
  it('renders nothing outside the funnel', () => {
    mockPath = '/'
    const { container } = render(<FunnelLegalFooter />)
    expect(container).toBeEmptyDOMElement()
  })
})
