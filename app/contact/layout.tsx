import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contacta con Luis y Sara para contratar actuaciones, workshops o festivales de Bachata y Bachatango. Disponibles para eventos en todo el mundo.",
  openGraph: {
    title: "Contacto | Luis y Sara Bachatango",
    description: "Contacta con Luis y Sara para actuaciones, workshops o festivales. Disponibles para eventos en todo el mundo.",
    url: "/contact",
  },
  alternates: { canonical: "/contact" },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
