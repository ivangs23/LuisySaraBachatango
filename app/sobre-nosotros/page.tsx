import type { Metadata } from 'next'
import AboutClient from './AboutClient'
import { getLandingStats } from '@/utils/landing/content'

export const metadata: Metadata = {
  title: 'Sobre nosotros | Luis y Sara Bachatango',
  description: 'Conoce a Luis y Sara, instructores internacionales de Bachata y Bachatango.',
  openGraph: {
    title: 'Sobre nosotros | Luis y Sara Bachatango',
    description: 'Conoce a Luis y Sara, instructores internacionales.',
    url: '/sobre-nosotros',
    images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: 'Luis y Sara' }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: '/sobre-nosotros' },
}

export default async function AboutPage() {
  const stats = await getLandingStats()
  return <AboutClient stats={stats} />
}
