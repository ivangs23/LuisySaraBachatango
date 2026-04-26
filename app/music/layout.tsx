import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Música",
  description: "Escucha la playlist oficial de Luis y Sara Bachatango. La música que usamos en nuestras clases y que inspira cada paso de Bachata y Bachatango.",
  openGraph: {
    title: "Música | Luis y Sara Bachatango",
    description: "Escucha la playlist oficial de Luis y Sara Bachatango. La música que usamos en nuestras clases.",
    url: "/music",
    images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: 'Playlists de Bachatango de Luis y Sara' }],
  },
  alternates: { canonical: "/music" },
};

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
