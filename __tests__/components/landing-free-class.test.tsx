// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// El reproductor real se carga en diferido con next/dynamic. Aquí basta un
// doble que permita disparar `onPlay` tantas veces como se quiera: pausar y
// reanudar, o volver a empezar, emiten un `play` nuevo cada vez.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MuxPlayerDoble(props: { onPlay?: () => void }) {
      return <button type="button" data-testid="play" onClick={() => props.onPlay?.()} />
    },
}))

import LandingFreeClass from '@/app/curso-bachatango/_components/LandingFreeClass'

const sendBeacon = vi.fn((url: string, data?: BodyInit | null) => { void url; void data; return true })

function pintar() {
  render(
    <LandingFreeClass playbackId="pb1" playbackToken="tok" thumbnailToken="thumb" title="Clase" />,
  )
}

describe('LandingFreeClass · medición de reproducciones', () => {
  beforeEach(() => {
    sendBeacon.mockClear()
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
  })

  it('no cuenta nada hasta que el vídeo empieza a reproducirse', () => {
    pintar()
    // Pulsar la portada monta el reproductor, pero el navegador aún puede
    // bloquear la reproducción: eso no es una reproducción.
    fireEvent.click(screen.getByRole('button', { name: /Reproducir la clase gratis/ }))
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('manda un solo evento aunque haya varios play en la misma carga', async () => {
    pintar()
    fireEvent.click(screen.getByRole('button', { name: /Reproducir la clase gratis/ }))
    const play = screen.getByTestId('play')
    fireEvent.click(play)
    fireEvent.click(play)
    fireEvent.click(play)

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, payload] = sendBeacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe('/api/landing-event')
    expect(JSON.parse(await payload.text())).toEqual({ path: '/curso-bachatango/clase-play' })
  })

  it('no revienta si el navegador no soporta sendBeacon', () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true })
    pintar()
    fireEvent.click(screen.getByRole('button', { name: /Reproducir la clase gratis/ }))
    expect(() => fireEvent.click(screen.getByTestId('play'))).not.toThrow()
  })
})
