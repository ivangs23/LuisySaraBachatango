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
    heading: 'Responsable del tratamiento',
    body: 'El responsable del tratamiento de tus datos es Luis y Sara Bachatango. Para cualquier cuestión sobre privacidad o para ejercer tus derechos, escríbenos a contacto@luisysarabachatango.com.',
  },
  {
    heading: 'Datos que recopilamos',
    body: 'Al comprar un curso o crear tu cuenta recogemos: nombre completo, correo electrónico, contraseña (que almacenamos cifrada, nunca en claro), país, ciudad, código postal, fecha de nacimiento, nivel de baile y, de forma opcional, teléfono. Registramos también la aceptación de los términos (con fecha y versión) y, si lo marcas, tu consentimiento para comunicaciones comerciales (con su fecha).\n\nDe forma automática registramos datos técnicos básicos —dirección IP, tipo de navegador, páginas visitadas— necesarios para el funcionamiento y la seguridad del servicio.',
  },
  {
    heading: 'Finalidades y base legal',
    body: 'Ejecución del contrato: gestionar tu cuenta, procesar el pago y darte acceso a los contenidos (art. 6.1.b RGPD).\n\nConsentimiento: enviarte novedades y ofertas, únicamente si lo has marcado expresamente; puedes retirarlo cuando quieras desde el propio email o tu perfil (art. 6.1.a RGPD).\n\nObligación legal: conservar los registros de facturación que exige la normativa fiscal (art. 6.1.c RGPD).\n\nInterés legítimo: seguridad, prevención del abuso y mejora del servicio (art. 6.1.f RGPD).',
  },
  {
    heading: 'Proveedores y transferencias internacionales',
    body: 'Para prestar el servicio compartimos los datos estrictamente necesarios con encargados del tratamiento que actúan bajo contrato: Stripe (pagos), Supabase (base de datos y autenticación), Resend (envío de emails), Vercel (alojamiento), Mux (vídeo) y Sentry (registro de errores).\n\nAlgunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo; en esos casos las transferencias se amparan en las garantías previstas por el RGPD (cláusulas contractuales tipo u otras salvaguardas adecuadas). No vendemos ni cedemos tus datos a terceros con fines publicitarios.',
  },
  {
    heading: 'Conservación',
    body: 'Conservamos los datos de tu cuenta mientras esté activa. Si la eliminas, suprimimos tus datos personales, salvo los registros que debamos conservar por obligación legal (por ejemplo, la facturación).\n\nLos registros de compras iniciadas pero no completadas se conservan un máximo de 30 días y después se eliminan automáticamente.',
  },
  {
    heading: 'Seguridad y tus derechos',
    body: 'Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito, contraseñas almacenadas con hash, controles de acceso y minimización de los datos expuestos.\n\nPuedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, así como retirar tu consentimiento, escribiéndonos a contacto@luisysarabachatango.com. También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
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
