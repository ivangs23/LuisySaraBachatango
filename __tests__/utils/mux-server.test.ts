import { describe, it, expect, vi } from 'vitest'

// Define the spy at module level so tests can reference it.
// The mock factory is hoisted by Vitest, so we use vi.hoisted() to lift
// the spy declaration above the vi.mock() call.
const { signPlaybackId } = vi.hoisted(() => ({
  signPlaybackId: vi.fn().mockResolvedValue('signed-token'),
}))

vi.mock('@mux/mux-node', () => {
  class MockMux {
    jwt = { signPlaybackId }
  }
  return { default: MockMux }
})

// unstable_cache requires a real Next.js request context to function.
// In unit tests we replace it with an identity wrapper so the inner
// sign function is called directly — this lets us assert on signPlaybackId
// without standing up the full Next runtime.
vi.mock('next/cache', () => ({
  unstable_cache: <Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) => fn,
}))

import { signPlaybackToken, signThumbnailToken, signPlaybackTokenForUser, signThumbnailTokenForUser } from '@/utils/mux/server'

describe('Mux JWT defaults', () => {
  it('signPlaybackToken uses 30m expiration by default', async () => {
    signPlaybackId.mockClear()
    await signPlaybackToken('abc')
    expect(signPlaybackId).toHaveBeenCalledWith('abc', {
      type: 'video',
      expiration: '30m',
    })
  })

  it('signThumbnailToken uses 30m expiration by default', async () => {
    signPlaybackId.mockClear()
    await signThumbnailToken('xyz')
    expect(signPlaybackId).toHaveBeenCalledWith('xyz', {
      type: 'thumbnail',
      expiration: '30m',
    })
  })

  it('respects an explicit expiration override', async () => {
    signPlaybackId.mockClear()
    await signPlaybackToken('abc', '5m')
    expect(signPlaybackId).toHaveBeenCalledWith('abc', {
      type: 'video',
      expiration: '5m',
    })
  })
})

describe('Cached Mux JWT wrappers', () => {
  it('signPlaybackTokenForUser delegates to signPlaybackId with 30m', async () => {
    signPlaybackId.mockClear()
    await signPlaybackTokenForUser('plybk', 'user-1')
    expect(signPlaybackId).toHaveBeenCalledWith('plybk', { type: 'video', expiration: '30m' })
  })

  it('signThumbnailTokenForUser delegates to signPlaybackId with 30m', async () => {
    signPlaybackId.mockClear()
    await signThumbnailTokenForUser('plybk', 'user-1')
    expect(signPlaybackId).toHaveBeenCalledWith('plybk', { type: 'thumbnail', expiration: '30m' })
  })
})
