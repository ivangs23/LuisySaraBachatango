import type { Metadata } from 'next'
import MusicClient from './MusicClient'

export const metadata: Metadata = {
  title: 'Música | Luis y Sara Bachatango',
  description: 'Playlist seleccionada para entrenar Bachata y Bachatango.',
  openGraph: {
    title: 'Música | Luis y Sara Bachatango',
    description: 'Playlist seleccionada para Bachata y Bachatango.',
    url: '/music',
    images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: 'Música Bachatango' }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: '/music' },
}

export default function MusicPage() {
  return <MusicClient />
}
