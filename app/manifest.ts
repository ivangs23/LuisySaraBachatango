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
    icons: [
      {
        src: '/logo.png',
        sizes: 'any',
        type: 'image/png',
      },
      {
        src: '/favicon.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
    ],
  }
}
