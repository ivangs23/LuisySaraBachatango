import type { Metadata } from 'next'
import ContactClient from './ContactClient'

export const metadata: Metadata = {
  title: 'Contacto | Luis y Sara Bachatango',
  description: 'Contacta con Luis y Sara para bookings, festivales o consultas.',
  openGraph: {
    title: 'Contacto | Luis y Sara Bachatango',
    description: 'Contacta con Luis y Sara para bookings, festivales o consultas.',
    url: '/contact',
    images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: 'Contacto' }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return <ContactClient />
}
