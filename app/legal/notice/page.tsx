import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '../_components/LegalShell';

export const metadata: Metadata = {
  title: 'Aviso Legal',
  description:
    'Aviso legal de Luis y Sara Bachatango. Información sobre el titular de la plataforma y las condiciones de uso.',
  openGraph: {
    title: 'Aviso Legal | Luis y Sara Bachatango',
    url: '/legal/notice',
  },
  alternates: { canonical: '/legal/notice' },
  robots: { index: true, follow: false },
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'Información del titular',
    body: 'Este sitio web es operado por Luis y Sara Bachatango, escuela y plataforma de formación dedicada a la enseñanza de Bachata y Bachatango.\n\nPara cualquier consulta relacionada con este aviso o con el funcionamiento de la plataforma, puedes escribirnos a contacto@luisysarabachatango.com y te responderemos en un plazo máximo de 48 horas laborables.',
  },
  {
    heading: 'Responsabilidad',
    body: 'No nos hacemos responsables de los daños o perjuicios que puedan derivarse del uso de este sitio web o de sus contenidos, ni de la información obtenida a través de enlaces externos a los que pudiéramos remitir.\n\nLos contenidos formativos tienen carácter informativo y educativo. Cada usuario es responsable de adaptar la práctica a sus condiciones físicas y de buscar acompañamiento profesional cuando sea necesario.',
  },
  {
    heading: 'Ley aplicable',
    body: 'Este aviso legal se rige por las leyes de España. Cualquier disputa derivada del uso del sitio o de los servicios contratados se someterá a los tribunales competentes del lugar de residencia del consumidor cuando así lo establezca la legislación vigente.',
  },
];

export default function LegalNoticePage() {
  return (
    <LegalShell
      chapter="DOCUMENTO 01"
      eyebrow="AVISO · LEGAL"
      title="Aviso Legal"
      intro="Quiénes somos, cómo contactar con nosotros y bajo qué marco legal operamos. Este documento responde con claridad a las preguntas básicas sobre la titularidad y responsabilidad de esta plataforma."
      sections={SECTIONS}
    />
  );
}
