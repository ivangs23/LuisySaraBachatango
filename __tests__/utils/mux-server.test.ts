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

import { signPlaybackToken, signThumbnailToken } from '@/utils/mux/server'

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
