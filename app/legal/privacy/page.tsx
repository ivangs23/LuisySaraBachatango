import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '../_components/LegalShell';
import { ENTITY, DPA } from '@/utils/legal/entity';

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
    body: `${ENTITY.legalName} es el RESPONSABLE del tratamiento de los datos personales del USUARIO y le informa de que estos datos serán tratados de conformidad con lo dispuesto en el Reglamento (UE) 2016/679, de 27 de abril (RGPD), y la Ley Orgánica 3/2018, de 5 de diciembre (LOPDGDD).`,
    bullets: [
      `Denominación: ${ENTITY.legalName}`,
      `NIF: ${ENTITY.taxId}`,
      `Domicilio: ${ENTITY.address}`,
      `Correo electrónico: ${ENTITY.email}`,
    ],
  },
  {
    heading: 'Qué datos tratamos y con qué finalidad',
    body: `Según el formulario a través del cual hayamos obtenido tus datos personales, los trataremos de manera confidencial para alcanzar los siguientes fines.`,
  },
  {
    heading: 'Compra de un curso y alta de cuenta',
    body: `Al comprar un curso creamos tu cuenta de alumno. Recogemos: nombre completo, correo electrónico, contraseña (que almacenamos siempre cifrada, nunca en claro), país, ciudad, código postal, fecha de nacimiento, nivel de baile y, de forma opcional, teléfono. Registramos también la aceptación de las condiciones de contratación, con su fecha y versión, y tu solicitud expresa de acceso inmediato al contenido digital.

Finalidad: formalizar la compra, crear y gestionar tu cuenta, procesar el pago, darte acceso a los contenidos y emitir la factura correspondiente.

Base jurídica: la ejecución de un contrato o precontrato del que eres parte (art. 6.1.b RGPD) y, en lo relativo a la facturación, el cumplimiento de una obligación legal (art. 6.1.c RGPD).`,
  },
  {
    heading: 'Comunicaciones comerciales',
    body: `Si marcas la casilla correspondiente al comprar, o si te suscribes al boletín, tratamos tu correo electrónico para enviarte novedades, contenidos y ofertas sobre nuestros cursos. En el caso del boletín registramos además la fecha, el origen y la dirección IP desde la que prestaste el consentimiento, como prueba de que fue libre e informado.

Base jurídica: tu consentimiento (art. 6.1.a RGPD), que puedes retirar en cualquier momento desde el enlace de baja incluido en cada correo o escribiéndonos, sin que ello afecte a la licitud del tratamiento previo.

Adicionalmente, y respecto de quienes ya son clientes, podremos enviar comunicaciones sobre productos o servicios similares a los que fueron objeto de contratación, conforme al artículo 21.2 de la LSSI y por interés legítimo del responsable (art. 6.1.f RGPD). También en este caso puedes oponerte en cualquier momento y de forma gratuita.`,
  },
  {
    heading: 'Formulario de contacto',
    body: `Cuando nos escribes desde el formulario de contacto recogemos tu nombre, tu correo electrónico, el tipo de consulta y el mensaje que nos envías.

Finalidad: atender y responder tu consulta, y mantener el histórico de la conversación mientras siga siendo pertinente.

Base jurídica: tu consentimiento al remitir la solicitud y, cuando la consulta versa sobre una contratación, la aplicación de medidas precontractuales a petición tuya (arts. 6.1.a y 6.1.b RGPD).`,
  },
  {
    heading: 'Comunidad, progreso y tareas',
    body: `Si participas en el foro de la comunidad tratamos las publicaciones, comentarios y reacciones que decidas escribir, asociados a tu perfil. Si realizas las tareas de las lecciones, tratamos tus entregas y las correcciones del profesorado, así como el registro de las lecciones que completas.

Finalidad: prestar el servicio formativo contratado, permitir la interacción entre alumnado y hacer posible el seguimiento del progreso y la corrección de las tareas.

Base jurídica: la ejecución del contrato de formación (art. 6.1.b RGPD).

Ten presente que las publicaciones del foro son visibles para el resto de alumnado; eres responsable de la información personal que decidas compartir en ellas.`,
  },
  {
    heading: 'Medición de audiencia',
    body: `Registramos estadísticas de visita de las páginas públicas mediante un identificador derivado, renovado a diario, que no permite reconstruir tu identidad ni seguirte entre días, y que no utiliza cookies.

Si prestas tu consentimiento en el aviso de cookies, utilizamos además herramientas de analítica y de medición publicitaria de terceros. El detalle de cada una figura en la Política de cookies.

Base jurídica: el interés legítimo del responsable en conocer el uso agregado del sitio para la medición cookieless (art. 6.1.f RGPD), y tu consentimiento para las herramientas de terceros (art. 6.1.a RGPD).`,
  },
  {
    heading: 'Durante cuánto tiempo guardamos tus datos',
    body: `Con carácter general, los datos se conservarán durante no más tiempo del necesario para mantener el fin del tratamiento, o mientras existan prescripciones legales que dictaminen su custodia. Cuando ya no sean necesarios se suprimirán con medidas de seguridad adecuadas.`,
    bullets: [
      'Datos de tu cuenta: mientras la cuenta permanezca activa. Si la eliminas, se suprimen tus datos personales salvo aquellos que debamos conservar por obligación legal.',
      'Datos de facturación: durante los plazos exigidos por la normativa fiscal y mercantil.',
      'Datos del boletín: hasta que retires tu consentimiento. Conservamos la prueba de la baja para poder acreditar que se atendió.',
      'Compras iniciadas pero no completadas: un máximo de 30 días, tras los cuales se eliminan automáticamente.',
      'Mensajes del formulario de contacto: mientras sean pertinentes para atender la consulta y acreditar su respuesta.',
    ],
  },
  {
    heading: 'A quién comunicamos tus datos',
    body: `No está prevista ninguna comunicación de datos personales a terceros, salvo cuando sea necesario para el desarrollo y ejecución de las finalidades descritas, a los proveedores que actúan como encargados del tratamiento y con los que el RESPONSABLE tiene suscritos los contratos exigidos por el artículo 28 del RGPD, o bien por obligación legal.

No vendemos ni cedemos tus datos a terceros con fines publicitarios.`,
    tables: [
      {
        caption: 'Encargados del tratamiento',
        headers: ['Proveedor', 'Servicio prestado'],
        rows: [
          ['Stripe', 'Procesamiento de los pagos y facturación'],
          ['Supabase', 'Base de datos y autenticación de las cuentas'],
          ['Vercel', 'Alojamiento del sitio web'],
          ['Mux', 'Alojamiento y reproducción de los vídeos'],
          ['Resend', 'Envío de los correos transaccionales'],
        ],
      },
    ],
  },
  {
    heading: 'Transferencias internacionales',
    body: `Algunos de los proveedores anteriores pueden tratar datos fuera del Espacio Económico Europeo. En esos casos, las transferencias se amparan en las garantías previstas por el capítulo V del RGPD: decisión de adecuación de la Comisión Europea o, en su defecto, cláusulas contractuales tipo junto con las medidas complementarias que resulten necesarias.

Puedes solicitarnos información sobre las garantías aplicadas a cada proveedor escribiendo a ${ENTITY.email}.`,
  },
  {
    heading: 'Carácter obligatorio o facultativo de la información',
    body: `Los campos marcados con un asterisco en los formularios son necesarios para atender tu petición; la inclusión de datos en los campos restantes es voluntaria. Al facilitarlos, aceptas de forma libre e inequívoca que son necesarios para la finalidad indicada en cada caso.

El USUARIO garantiza que los datos personales facilitados son veraces y se hace responsable de comunicar cualquier modificación de los mismos. Si no se facilitan los datos necesarios, no podremos garantizar que la información y los servicios prestados se ajusten completamente a tus necesidades.`,
  },
  {
    heading: 'Medidas de seguridad',
    body: `El RESPONSABLE trata los datos de manera lícita, leal y transparente, y limitados a lo necesario en relación con los fines para los que son tratados, conforme a los principios del artículo 5 del RGPD.

Aplicamos medidas técnicas y organizativas apropiadas: cifrado de las comunicaciones en tránsito, almacenamiento de las contraseñas mediante funciones de hash, controles de acceso por roles, minimización de los datos expuestos y acceso restringido a la información en función del perfil de cada usuario.`,
  },
  {
    heading: 'Tus derechos',
    body: `Puedes ejercer en cualquier momento los siguientes derechos, de forma gratuita:`,
    bullets: [
      'Retirar el consentimiento en cualquier momento, sin que ello afecte a la licitud del tratamiento previo.',
      'Acceso, rectificación, portabilidad y supresión de tus datos.',
      'Limitación y oposición a su tratamiento.',
      `Presentar una reclamación ante la autoridad de control, la ${DPA.name} (${DPA.url}), si consideras que el tratamiento no se ajusta a la normativa vigente.`,
    ],
  },
  {
    heading: 'Cómo ejercer tus derechos',
    body: `Dirígete al RESPONSABLE por cualquiera de estos medios, indicando el derecho que deseas ejercer y acompañando un documento que acredite tu identidad:

Correo postal: ${ENTITY.legalName}, ${ENTITY.addressShort}.

Correo electrónico: ${ENTITY.email}.

Responderemos en el plazo máximo de un mes desde la recepción de tu solicitud, prorrogable en los términos previstos por el artículo 12.3 del RGPD.`,
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
      updatedAt="2026-09-01"
    />
  );
}
