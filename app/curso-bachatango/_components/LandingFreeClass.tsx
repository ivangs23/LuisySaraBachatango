'use client'

import { useCallback, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Play } from 'lucide-react'
import styles from './LandingFreeClass.module.css'

/**
 * El reproductor de Mux pesa varios cientos de kB y arrastra su propio
 * runtime. Cargarlo en la landing solo para enseñar un fotograma quieto
 * penalizaría el LCP de la página que más importa vender, así que se carga
 * bajo demanda: hasta que alguien pulsa, esto es una imagen y un botón.
 */
const MuxPlayer = dynamic(() => import('@mux/mux-player-react'), {
  ssr: false,
  loading: () => <div className={styles.loading} aria-live="polite">Cargando…</div>,
})

/**
 * Se adelanta la descarga del chunk al primer indicio de intención (puntero
 * encima o foco por teclado). Sin esto, el chunk empieza a bajar EN el clic:
 * el reproductor tarda en montar, y para entonces el navegador ya no asocia
 * la reproducción al gesto del usuario y bloquea el audio.
 */
function preloadPlayer() {
  void import('@mux/mux-player-react')
}

interface Props {
  playbackId: string
  playbackToken: string
  thumbnailToken: string
  title: string
  /** Segundo del vídeo del que sacar el fotograma de portada. */
  posterTime?: number
}

export default function LandingFreeClass({
  playbackId, playbackToken, thumbnailToken, title, posterTime = 3,
}: Props) {
  const [playing, setPlaying] = useState(false)
  const startedRef = useRef(false)

  // El token de miniatura es obligatorio: la reproducción está firmada, así
  // que image.mux.com devuelve 403 sin él.
  const poster =
    `https://image.mux.com/${playbackId}/thumbnail.jpg` +
    `?token=${encodeURIComponent(thumbnailToken)}&time=${posterTime}`

  /**
   * `autoPlay` a secas no basta: la política de autoreproducción exige que la
   * llamada cuelgue de un gesto, y aquí el elemento nace después del clic. Se
   * llama a play() en cuanto existe el nodo, que es lo más cerca del gesto a
   * lo que se puede llegar.
   *
   * Si aun así el navegador lo rechaza, no se fuerza ni se silencia el audio:
   * es una clase de baile y la música es media clase. Queda el reproductor con
   * sus controles a la vista, que es el peor caso aceptable.
   */
  // Se tipa por lo único que se usa en vez de importar `MuxPlayerElement`:
  // ese tipo viaja en el módulo que aquí se carga en diferido, y traerlo
  // aunque sea solo como tipo invita a que alguien lo convierta en import
  // normal y devuelva el reproductor al bundle inicial.
  const attachPlayer = useCallback((node: { play?: () => Promise<void> | void } | null) => {
    if (!node || startedRef.current) return
    startedRef.current = true
    const p = node.play?.()
    if (p && typeof p.catch === 'function') {
      p.catch(() => { /* bloqueado por el navegador: quedan los controles */ })
    }
  }, [])

  if (playing) {
    return (
      <div className={styles.frame}>
        <MuxPlayer
          ref={attachPlayer}
          playbackId={playbackId}
          tokens={{ playback: playbackToken, thumbnail: thumbnailToken }}
          metadata={{ video_title: title }}
          autoPlay
          className={styles.player}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      className={styles.frame}
      onClick={() => setPlaying(true)}
      onPointerEnter={preloadPlayer}
      onFocus={preloadPlayer}
      aria-label={`Reproducir la clase gratis: ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- image.mux.com
          firma la URL con un token de un solo uso por render; el optimizador
          de next/image la reescribiría y perdería la firma. */}
      <img src={poster} alt="" className={styles.poster} loading="lazy" decoding="async" />
      <span className={styles.scrim} aria-hidden="true" />
      <span className={styles.playBadge} aria-hidden="true">
        <Play size={26} strokeWidth={2.2} fill="currentColor" />
      </span>
      <span className={styles.caption}>{title}</span>
    </button>
  )
}
