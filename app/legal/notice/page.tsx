import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '../_components/LegalShell';
import { ENTITY } from '@/utils/legal/entity';

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
    heading: 'Datos identificativos',
    body: `En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSICE), se hacen constar los datos identificativos del titular de este sitio web, en adelante el RESPONSABLE.`,
    bullets: [
      `Nombre de dominio: ${ENTITY.domain}`,
      `Nombre comercial: ${ENTITY.tradeName}`,
      `Denominación: ${ENTITY.legalName}`,
      `NIF: ${ENTITY.taxId}`,
      `Domicilio: ${ENTITY.address}`,
      `Teléfono: ${ENTITY.phone}`,
      `Correo electrónico: ${ENTITY.email}`,
    ],
  },
  {
    heading: 'Condiciones de uso',
    body: `El RESPONSABLE pone a disposición de los usuarios el presente documento con el fin de dar cumplimiento a las obligaciones dispuestas en la LSSICE, así como de informar a todos los usuarios del sitio web respecto a cuáles son las condiciones de uso.

Toda persona que acceda a este sitio web asume el papel de usuario, comprometiéndose a la observancia y cumplimiento riguroso de las disposiciones aquí dispuestas, así como a cualquier otra disposición legal que fuera de aplicación.

El RESPONSABLE se reserva el derecho de modificar cualquier tipo de información que pudiera aparecer en el sitio web, sin que exista obligación de preavisar o poner en conocimiento de los usuarios dichas modificaciones, entendiéndose como suficiente la publicación en el sitio web.`,
  },
  {
    heading: 'Derechos de propiedad intelectual e industrial',
    body: `El sitio web, incluyendo a título enunciativo pero no limitativo su programación, edición, compilación y demás elementos necesarios para su funcionamiento, los diseños, logotipos, texto y/o gráficos, son propiedad del RESPONSABLE o, si es el caso, dispone de licencia o autorización expresa por parte de los autores.

Independientemente de la finalidad para la que fueran destinados, la reproducción total o parcial, uso, explotación, distribución y comercialización requiere en todo caso la autorización escrita previa por parte del RESPONSABLE. Cualquier uso no autorizado previamente se considera un incumplimiento grave de los derechos de propiedad intelectual o industrial del autor.

Los diseños, logotipos, texto y/o gráficos ajenos al RESPONSABLE y que pudieran aparecer en el sitio web pertenecen a sus respectivos propietarios, siendo ellos mismos responsables de cualquier posible controversia que pudiera suscitarse respecto a los mismos. El RESPONSABLE autoriza expresamente a que terceros puedan redirigir directamente a los contenidos concretos del sitio web, y en todo caso redirigir al sitio web principal de ${ENTITY.domain}.

Para realizar cualquier tipo de observación respecto a posibles incumplimientos de los derechos de propiedad intelectual o industrial, así como sobre cualquiera de los contenidos del sitio web, puede hacerlo a través del correo electrónico ${ENTITY.email}.`,
  },
  {
    heading: 'Exención de responsabilidades',
    body: `El RESPONSABLE se exime de cualquier tipo de responsabilidad derivada de la información publicada en su sitio web siempre que no tenga conocimiento efectivo de que esta información haya sido manipulada o introducida por un tercero ajeno al mismo o, si lo tiene, haya actuado con diligencia para retirar los datos o hacer imposible el acceso a ellos.

Este sitio web se ha revisado y probado para que funcione correctamente. En principio, puede garantizarse el correcto funcionamiento los 365 días del año, 24 horas al día. Sin embargo, el RESPONSABLE no descarta la posibilidad de que existan ciertos errores de programación, o que acontezcan causas de fuerza mayor, catástrofes naturales, huelgas o circunstancias semejantes que hagan imposible el acceso a la página web.

Los contenidos formativos tienen carácter informativo y educativo. Cada usuario es responsable de adaptar la práctica a sus condiciones físicas y de buscar acompañamiento profesional cuando sea necesario.`,
  },
  {
    heading: 'Uso de cookies',
    body: `Este sitio web utiliza cookies técnicas, necesarias para su correcto funcionamiento, y cookies prescindibles de análisis y de publicidad que solo se instalan si el usuario presta previamente su consentimiento.

A todo usuario que visita la web se le informa del uso de estas cookies mediante un aviso. En el caso de aceptar su uso, el aviso desaparecerá, aunque en todo momento podrá revocar el consentimiento y obtener más información consultando nuestra Política de cookies.

El usuario tiene además la posibilidad de configurar su navegador para ser alertado de la recepción de cookies y para impedir su instalación en su equipo. Por favor, consulte las instrucciones de su navegador para ampliar esta información.`,
  },
  {
    heading: 'Política de enlaces',
    body: `Desde el sitio web es posible que se redirija a contenidos de terceros sitios web. Dado que el RESPONSABLE no puede controlar siempre los contenidos introducidos por terceros en sus respectivos sitios web, no asume ningún tipo de responsabilidad respecto a dichos contenidos. En todo caso, procederá a la retirada inmediata de cualquier contenido que pudiera contravenir la legislación nacional o internacional, la moral o el orden público, poniendo en conocimiento de las autoridades competentes el contenido en cuestión.

El RESPONSABLE no se hace responsable de la información y contenidos almacenados, a título enunciativo pero no limitativo, en foros, comentarios, redes sociales o cualquier otro medio que permita a terceros publicar contenidos de forma independiente en la página web del RESPONSABLE. No obstante, y en cumplimiento de lo dispuesto en los artículos 11 y 16 de la LSSICE, se pone a disposición de todos los usuarios, autoridades y fuerzas de seguridad, colaborando de forma activa en la retirada o, en su caso, bloqueo de todos aquellos contenidos que puedan afectar o contravenir la legislación nacional o internacional, los derechos de terceros o la moral y el orden público.

En caso de que el usuario considere que existe en el sitio web algún contenido que pudiera ser susceptible de esta clasificación, se ruega lo notifique de forma inmediata a ${ENTITY.email}.`,
  },
  {
    heading: 'Direcciones IP',
    body: `Los servidores del sitio web podrán detectar de manera automática la dirección IP y el nombre de dominio utilizados por el usuario. Una dirección IP es un número asignado automáticamente a un ordenador cuando este se conecta a Internet.

Toda esta información se registra en un fichero de actividad del servidor que permite el posterior procesamiento de los datos con el fin de obtener mediciones únicamente estadísticas que permitan conocer el número de impresiones de páginas, el número de visitas realizadas a los servidores web, el orden de visitas y el punto de acceso.`,
  },
  {
    heading: 'Ley aplicable y jurisdicción',
    body: `Para la resolución de todas las controversias o cuestiones relacionadas con el presente sitio web o de las actividades en él desarrolladas será de aplicación la legislación española, a la que se someten expresamente las partes, siendo competentes para la resolución de todos los conflictos derivados o relacionados con su uso los Juzgados y Tribunales del domicilio del USUARIO o el lugar del cumplimiento de la obligación.`,
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
      updatedAt="2026-09-01"
    />
  );
}
