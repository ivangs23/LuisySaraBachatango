import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Blog",
  description: "Artículos sobre técnica de Bachata y Bachatango, musicalidad, conexión y todo lo que necesitas saber para mejorar tu baile con Luis y Sara.",
  openGraph: {
    title: "Blog | Luis y Sara Bachatango",
    description: "Artículos sobre técnica de Bachata y Bachatango, musicalidad y conexión con Luis y Sara.",
    url: "/blog",
  },
  alternates: { canonical: "/blog" },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
