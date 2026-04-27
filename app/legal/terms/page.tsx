import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '../_components/LegalShell';

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description:
    'Consulta los términos y condiciones de uso de la plataforma de cursos online de Luis y Sara Bachatango.',
  openGraph: {
    title: 'Términos y Condiciones | Luis y Sara Bachatango',
    url: '/legal/terms',
  },
  alternates: { canonical: '/legal/terms' },
  robots: { index: true, follow: false },
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'Aceptación de los términos',
    body: 'Al acceder y utilizar este sitio web, aceptas quedar vinculado por los presentes Términos y Condiciones, así como por el resto de políticas que conforman este marco legal.\n\nSi no estás de acuerdo con alguna de las cláusulas aquí descritas, te pedimos que no utilices la plataforma. El uso continuado del servicio implica la aceptación expresa de cualquier actualización futura de estos términos.',
  },
  {
    heading: 'Uso del servicio',
    body: 'Te comprometes a utilizar nuestros servicios únicamente con fines legítimos y conforme a las indicaciones recogidas en este documento. Está prohibido compartir credenciales de acceso, redistribuir el contenido formativo o emplear la plataforma de manera que pueda dañar a otros usuarios.\n\nNos reservamos el derecho a suspender o cancelar cuentas que incumplan estas condiciones, así como a modificar o retirar contenidos cuando lo consideremos necesario.',
  },
  {
    heading: 'Propiedad intelectual',
    body: 'Todo el contenido publicado en este sitio —textos, gráficos, logotipos, vídeos, música, coreografías y materiales descargables— es propiedad de Luis y Sara Bachatango o de sus licenciantes y queda protegido por la legislación nacional e internacional de propiedad intelectual.\n\nLa suscripción concede una licencia personal e intransferible para acceder al contenido. Queda prohibida su reproducción, distribución, comunicación pública o transformación sin autorización escrita previa.',
  },
  {
    heading: 'Cancelación y reembolso',
    body: 'Puedes cancelar tu suscripción en cualquier momento desde tu área de perfil; mantendrás el acceso al contenido hasta el final del periodo ya facturado.\n\nLos reembolsos se gestionan caso por caso conforme a la normativa de consumo aplicable. Para solicitar uno, escríbenos explicando tu situación a contacto@luisysarabachatango.com y estudiaremos tu caso con la mayor diligencia posible.',
  },
];

export default function TermsPage() {
  return (
    <LegalShell
      chapter="DOCUMENTO 02"
      eyebrow="CONDICIONES · USO"
      title="Términos y Condiciones"
      intro="Las reglas del juego. Aquí explicamos qué esperamos de quienes utilizan la plataforma y qué puedes esperar de nosotros como escuela y servicio digital."
      sections={SECTIONS}
    />
  );
}
