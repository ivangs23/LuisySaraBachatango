import type { Metadata } from 'next'
import BlogClient from './BlogClient'

export const metadata: Metadata = {
  title: 'Blog | Luis y Sara Bachatango',
  description: 'Artículos sobre Bachata, Bachatango, técnica, musicalidad y comunidad.',
  openGraph: {
    title: 'Blog | Luis y Sara Bachatango',
    description: 'Artículos sobre Bachata y Bachatango.',
    url: '/blog',
    images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: 'Blog Bachatango' }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: '/blog' },
}

export default function BlogPage() {
  return <BlogClient />
}
