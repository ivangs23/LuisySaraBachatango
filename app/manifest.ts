import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Luis y Sara Bachatango',
    short_name: 'L&S Bachatango',
    description: 'Plataforma de cursos online de Bachata y Bachatango.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#c0a062',
    // /icon lo genera app/icon.tsx: 512x512 cuadrado. Antes se declaraba
    // /logo.png con sizes:'any', pero es 576x1024 y quedaba deformado al
    // instalar la PWA. `maskable` evita que Android recorte las siglas
    // dentro de su máscara circular.
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
