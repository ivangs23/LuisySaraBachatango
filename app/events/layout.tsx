import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Eventos",
  description: "Próximos eventos, festivales y workshops de Luis y Sara Bachatango. Encuéntranos en directo y baila con nosotros en todo el mundo.",
  openGraph: {
    title: "Eventos | Luis y Sara Bachatango",
    description: "Próximos eventos, festivales y workshops de Luis y Sara Bachatango. Encuéntranos en directo.",
    url: "/events",
    images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: 'Eventos y workshops de Luis y Sara Bachatango' }],
  },
  alternates: { canonical: "/events" },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
