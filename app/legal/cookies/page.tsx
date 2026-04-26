import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '../_components/LegalShell';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description:
    'Información sobre el uso de cookies en la plataforma de Luis y Sara Bachatango.',
  openGraph: {
    title: 'Política de Cookies | Luis y Sara Bachatango',
    url: '/legal/cookies',
  },
  alternates: { canonical: '/legal/cookies' },
  robots: { index: true, follow: false },
};

const SECTIONS: LegalSection[] = [
  {
    heading: '¿Qué son las cookies?',
    body: 'Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita un sitio web. Permiten que el sitio recuerde sus acciones y preferencias durante un periodo de tiempo, evitando que tenga que reintroducirlas cada vez que vuelva.',
  },
  {
    heading: 'Cómo utilizamos las cookies',
    body: 'Utilizamos cookies para mejorar su experiencia en nuestro sitio web, recordar sus preferencias —como el idioma o el inicio de sesión— y analizar el tráfico de forma anónima para mejorar nuestros contenidos y la calidad de los cursos que ofrecemos.',
  },
  {
    heading: 'Gestión de cookies',
    body: 'Puede controlar y administrar las cookies a través de la configuración de su navegador. Tenga en cuenta que desactivar ciertas cookies puede afectar al funcionamiento de algunas áreas del sitio, como el acceso a su cuenta o la reproducción de las clases.',
  },
];

export default function CookiesPage() {
  return (
    <LegalShell
      chapter="DOCUMENTO 03"
      eyebrow="POLÍTICA · COOKIES"
      title="Política de Cookies"
      intro="Las cookies son una herramienta esencial para que esta plataforma funcione bien. Este documento explica con transparencia qué cookies usamos, para qué, y cómo puedes gestionarlas en cualquier momento."
      sections={SECTIONS}
    />
  );
}
