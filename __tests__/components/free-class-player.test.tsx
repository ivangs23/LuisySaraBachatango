// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@mux/mux-player-react', () => ({
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="mux-player"
      data-playback-id={String(props.playbackId)}
      data-has-playback-token={String(Boolean((props.tokens as Record<string, string>)?.playback))}
      data-has-thumb-token={String(Boolean((props.tokens as Record<string, string>)?.thumbnail))}
      data-metadata={JSON.stringify(props.metadata)}
    />
  ),
}))

import FreeClassPlayer from '@/components/FreeClassPlayer'

function renderPlayer(posterUrl: string | null = null) {
  render(
    <FreeClassPlayer
      playbackId="pb1"
      playbackToken="tok"
      thumbnailToken="thumb"
      posterUrl={posterUrl}
      title="Clase 1"
    />,
  )
  return screen.getByTestId('mux-player')
}

describe('FreeClassPlayer', () => {
  it('pasa playbackId y ambos tokens al reproductor', () => {
    const player = renderPlayer()
    expect(player).toHaveAttribute('data-playback-id', 'pb1')
    expect(player).toHaveAttribute('data-has-playback-token', 'true')
    expect(player).toHaveAttribute('data-has-thumb-token', 'true')
  })

  it('no envía viewer_user_id: el espectador puede ser anónimo', () => {
    const player = renderPlayer()
    const metadata = JSON.parse(player.getAttribute('data-metadata') ?? '{}')
    expect(metadata).toEqual({ video_title: 'Clase 1' })
    expect(metadata).not.toHaveProperty('viewer_user_id')
  })
})
