import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Sobre Nosotros",
  description: "Conoce a Luis y Sara, la pareja de bailarines internacionales detrás de Bachatango. Más de 15 años de experiencia, 50.000 alumnos y actuaciones en más de 30 países.",
  openGraph: {
    title: "Sobre Nosotros | Luis y Sara Bachatango",
    description: "Conoce a Luis y Sara, bailarines internacionales con más de 15 años de experiencia y actuaciones en más de 30 países.",
    url: "/sobre-nosotros",
    images: [{ url: "/luis-sara-about.jpg", width: 1200, height: 630, alt: "Luis y Sara Bachatango" }],
  },
  alternates: { canonical: "/sobre-nosotros" },
};

export default function SobreNosotrosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
