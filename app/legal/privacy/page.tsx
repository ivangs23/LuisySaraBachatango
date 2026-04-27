import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '../_components/LegalShell';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Consulta nuestra política de privacidad. Información sobre el tratamiento de tus datos personales en la plataforma de cursos de Luis y Sara Bachatango.',
  openGraph: {
    title: 'Política de Privacidad | Luis y Sara Bachatango',
    url: '/legal/privacy',
  },
  alternates: { canonical: '/legal/privacy' },
  robots: { index: true, follow: false },
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'Información que recopilamos',
    body: 'Recopilamos los datos que tú nos proporcionas directamente al crear una cuenta, suscribirte a un curso, completar tu perfil o contactar con nuestro equipo. Esto incluye nombre, dirección de correo electrónico, datos de facturación e información que decidas compartir voluntariamente.\n\nAdicionalmente, registramos información técnica básica —como dirección IP, tipo de navegador o páginas visitadas— necesaria para garantizar el correcto funcionamiento del servicio y mejorar la experiencia de aprendizaje.',
  },
  {
    heading: 'Cómo utilizamos su información',
    body: 'Utilizamos tus datos para prestar y mejorar el servicio: gestionar tu cuenta, procesar pagos, dar acceso a los contenidos, atender consultas y enviarte avisos técnicos relevantes.\n\nSolo te enviaremos comunicaciones comerciales si nos has dado tu consentimiento expreso, y siempre podrás revocarlo en cualquier momento desde el propio correo o desde tu perfil.',
  },
  {
    heading: 'Compartir información',
    body: 'No vendemos ni cedemos tu información personal a terceros. Únicamente compartimos los datos estrictamente necesarios con proveedores de confianza —como pasarelas de pago, alojamiento o herramientas de analítica— y siempre bajo contratos que garantizan un nivel adecuado de protección.\n\nTambién podríamos compartir información si una autoridad competente lo solicita formalmente conforme a la ley.',
  },
  {
    heading: 'Seguridad',
    body: 'Aplicamos medidas técnicas y organizativas razonables para proteger tu información frente a pérdida, robo, uso indebido o acceso no autorizado: cifrado en tránsito, controles de acceso y revisiones periódicas de nuestros sistemas.\n\nPuedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiéndonos a contacto@luisysarabachatango.com.',
  },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      chapter="DOCUMENTO 04"
      eyebrow="POLÍTICA · PRIVACIDAD"
      title="Política de Privacidad"
      intro="Tu confianza es la base de esta plataforma. Aquí te explicamos qué datos tratamos, con qué fines, durante cuánto tiempo y cómo puedes ejercer tus derechos en cualquier momento."
      sections={SECTIONS}
    />
  );
}
