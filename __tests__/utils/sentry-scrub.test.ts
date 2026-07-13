import { describe, it, expect } from 'vitest'
import { scrubSensitive } from '@/utils/sentry/scrub'

describe('scrubSensitive', () => {
  it('filters sensitive keys recursively in request.data and extra', () => {
    const event = {
      request: { data: { email: 'a@b.com', password: 'Secret1', nested: { repeatPassword: 'Secret1', ok: 1 } } },
      extra: { payload: { password_hash: '$2b$12$x', keep: 'yes' }, list: [{ password: 'p' }] },
    }
    scrubSensitive(event)
    expect(event.request.data.password).toBe('[Filtered]')
    expect(event.request.data.email).toBe('a@b.com')
    expect((event.request.data.nested as Record<string, unknown>).repeatPassword).toBe('[Filtered]')
    expect((event.extra.payload as Record<string, unknown>).password_hash).toBe('[Filtered]')
    expect((event.extra.payload as Record<string, unknown>).keep).toBe('yes')
    expect((event.extra.list as Array<Record<string, unknown>>)[0].password).toBe('[Filtered]')
  })
  it('no-ops on an event without data/extra', () => {
    const event = {}
    expect(() => scrubSensitive(event)).not.toThrow()
  })
})
