import { describe, it, expect } from 'vitest'
import { safeJsonLd } from '@/utils/jsonld'

describe('safeJsonLd', () => {
  it('escapes < to prevent script breakout', () => {
    const out = safeJsonLd({ name: 'before</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script>')
  })

  it('produces valid JSON when parsed back', () => {
    const data = { '@context': 'https://schema.org', name: 'Test < & >' }
    const out = safeJsonLd(data)
    expect(JSON.parse(out)).toEqual(data)
  })

  it('handles nested structures and arrays', () => {
    const data = { items: [{ q: 'a<b' }, { q: 'c</d' }] }
    const out = safeJsonLd(data)
    expect(out).not.toMatch(/[^\\]</)
    expect(JSON.parse(out)).toEqual(data)
  })
})
