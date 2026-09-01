import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '../_components/LegalShell';
import { ENTITY, DPA } from '@/utils/legal/entity';

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
    heading: 'Información sobre cookies',
    body: `Conforme a la Ley 34/2002, de 11 de julio, de servicios de la sociedad de la información y de comercio electrónico (LSSI), en relación con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD), es obligado obtener el consentimiento expreso del usuario antes de instalar cookies prescindibles.

Las cookies y otras tecnologías similares, como los píxeles, son herramientas empleadas por los servidores web para almacenar y recuperar información acerca de sus visitantes, así como para ofrecer un correcto funcionamiento del sitio.

Las cookies que requieren tu consentimiento informado son las de analítica y las de publicidad, quedando exceptuadas las de carácter técnico y las necesarias para el funcionamiento del sitio web o para la prestación de servicios que hayas solicitado expresamente.`,
  },
  {
    heading: 'Tipos de cookies',
    body: `Según su finalidad, las cookies pueden clasificarse en:`,
    bullets: [
      'Técnicas y funcionales: permiten la navegación y el uso de las distintas opciones o servicios del sitio, como iniciar sesión o recordar tu idioma.',
      'Analíticas: permiten el seguimiento y análisis del comportamiento agregado de los usuarios, con el fin de introducir mejoras en el servicio.',
      'Publicitarias y de publicidad comportamental: permiten gestionar los espacios publicitarios y adaptarlos a las preferencias deducidas de tu navegación.',
      'Sociales: las establecen las plataformas de redes sociales para permitirte compartir contenido, y pueden rastrear tu actividad fuera de este sitio.',
      'De seguridad: almacenan información cifrada para evitar que los datos guardados en ellas sean vulnerables a ataques de terceros.',
    ],
  },
  {
    heading: 'Propiedad y plazo de conservación',
    body: `Según quién las gestione, las cookies son propias, cuando se envían desde un dominio gestionado por el propio editor, o de terceros, cuando se envían desde un dominio gestionado por otra entidad que trata los datos obtenidos a través de ellas.

Según su duración, son de sesión, cuando recaban datos únicamente mientras accedes a la página, o persistentes, cuando los datos siguen almacenados en tu equipo durante un período definido por el responsable de la cookie.`,
  },
  {
    heading: 'Cookies controladas por el editor',
    body: `Son cookies propias y de carácter técnico. Resultan necesarias para el funcionamiento del sitio y para prestarte los servicios que solicitas expresamente, por lo que no requieren consentimiento.`,
    tables: [
      {
        caption: 'Técnicas y funcionales',
        headers: ['Propiedad', 'Cookie', 'Finalidad', 'Plazo'],
        rows: [
          [
            ENTITY.domain,
            'ls_consent',
            'Almacena tus preferencias de consentimiento de cookies para no volver a preguntarte en cada visita',
            '6 meses',
          ],
          [
            ENTITY.domain,
            'locale',
            'Recuerda el idioma en el que quieres ver el sitio',
            '1 año',
          ],
          [
            ENTITY.domain,
            'landing_form',
            'Conserva temporalmente los datos ya escritos en el formulario de compra para no obligarte a repetirlos si se produce un error de validación. No incluye en ningún caso la contraseña',
            '2 minutos',
          ],
          [
            ENTITY.domain,
            'sb-…-auth-token',
            'Mantiene tu sesión iniciada como alumno y permite renovarla de forma segura',
            'Sesión / renovable',
          ],
        ],
      },
    ],
  },
  {
    heading: 'Cookies de terceros',
    body: `Los servicios de terceros son ajenos al control del editor. Los proveedores pueden modificar en todo momento sus condiciones de servicio, la finalidad y la utilización de sus cookies.

Estas cookies se instalan al cargarse herramientas de medición o al reproducirse contenidos insertados de terceros, y únicamente se activan si prestas tu consentimiento en el aviso de cookies. Puedes retirarlo en cualquier momento desde el enlace de preferencias del pie de página.`,
    tables: [
      {
        caption: 'Analíticas — requieren tu consentimiento',
        headers: ['Propiedad', 'Cookie', 'Finalidad', 'Plazo'],
        rows: [
          [
            'google.com',
            '_ga',
            'Google Analytics: distingue usuarios para obtener estadísticas de uso del sitio',
            '2 años',
          ],
          [
            'google.com',
            '_ga_*',
            'Google Analytics: mantiene el estado de la sesión de medición',
            '2 años',
          ],
        ],
      },
      {
        caption: 'Publicitarias y de contenidos insertados — requieren tu consentimiento',
        headers: ['Propiedad', 'Cookie', 'Finalidad', 'Plazo'],
        rows: [
          [
            'facebook.com',
            '_fbp',
            'Meta Pixel: mide la eficacia de las campañas publicitarias y permite la publicidad personalizada',
            '3 meses',
          ],
          [
            'facebook.com',
            'datr',
            'Previene la creación de cuentas falsas y el spam. Se asocia a un navegador, no a una persona',
            '2 meses',
          ],
          [
            'instagram.com',
            'csrftoken',
            'Seguridad de la sesión frente a falsificación de peticiones en contenidos insertados de Instagram',
            '10 meses',
          ],
          [
            'instagram.com',
            'ig_did',
            'Identificación del dispositivo en contenidos insertados de Instagram',
            '16 días',
          ],
          [
            'instagram.com',
            'mid',
            'Identificación del navegador en contenidos insertados de Instagram',
            '2 meses',
          ],
          [
            'instagram.com',
            'sessionid',
            'Mantenimiento de la sesión del usuario en Instagram',
            '9 meses',
          ],
          [
            'spotify.com',
            'sp_landing',
            'Reproducción de las listas de Spotify insertadas en la sección de música',
            '22 horas',
          ],
          [
            'spotify.com',
            'sp_t',
            'Reproducción de las listas de Spotify insertadas en la sección de música',
            '1 año',
          ],
        ],
      },
      {
        caption: 'Políticas de privacidad de los proveedores externos',
        headers: ['Editor', 'Política de privacidad'],
        rows: [
          ['Google', 'https://policies.google.com/privacy'],
          ['Meta (Facebook)', 'https://www.facebook.com/about/privacy/'],
          ['Meta (Instagram)', 'https://privacycenter.instagram.com/policy'],
          ['Spotify', 'https://www.spotify.com/es/legal/privacy-policy/'],
        ],
      },
    ],
  },
  {
    heading: 'Medición sin cookies',
    body: `Además de lo anterior, registramos estadísticas agregadas de visita de las páginas públicas sin utilizar cookies ni almacenar nada en tu dispositivo. Para poder contar visitantes distintos empleamos un identificador derivado que se renueva cada día, de modo que no permite reconstruir tu identidad ni seguir tu actividad entre jornadas.

Por su carácter anónimo y su nulo impacto en tu equipo, esta medición no requiere consentimiento.`,
  },
  {
    heading: 'Cómo gestionar las cookies',
    body: `Desde el panel de preferencias, accesible en todo momento desde el enlace del pie de página, puedes configurar las cookies que este sitio puede instalar en tu navegador, con la excepción de las técnicas o funcionales, que son necesarias para la navegación.

También puedes gestionarlas desde tu propio navegador:`,
    bullets: [
      'Eliminar las cookies del dispositivo: borrando el historial del navegador se suprimen las cookies de todos los sitios visitados, con lo que también puedes perder parte de la información guardada, como los datos de inicio de sesión.',
      'Gestionar las cookies específicas del sitio: los navegadores permiten un control más preciso desde su configuración de privacidad.',
      'Bloquear las cookies: la mayoría de navegadores puede configurarse para impedir su instalación, aunque eso puede obligar a ajustar preferencias manualmente en cada visita y algunos servicios pueden dejar de funcionar correctamente.',
    ],
    tables: [
      {
        caption: 'Cómo eliminar las cookies en los navegadores más comunes',
        headers: ['Navegador', 'Instrucciones'],
        rows: [
          ['Chrome', 'https://support.google.com/chrome/answer/95647?hl=es'],
          ['Edge', 'https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09'],
          ['Firefox', 'https://www.mozilla.org/es-ES/privacy/websites/#cookies'],
          ['Safari', 'https://support.apple.com/es-es/guide/safari/sfri11471/mac'],
          ['Opera', 'https://help.opera.com/en/latest/security-and-privacy/#clearBrowsingData'],
        ],
      },
    ],
  },
  {
    heading: 'Tratamiento de datos personales',
    body: `${ENTITY.legalName}, con NIF ${ENTITY.taxId} y domicilio en ${ENTITY.addressShort}, es el Responsable del tratamiento de los datos personales del interesado y le informa de que serán tratados conforme al RGPD.

Fines del tratamiento: los que se especifican en las tablas de cookies de este documento.

Legitimación: salvo en los casos en que resulte necesario para la navegación por la web, el consentimiento del interesado (art. 6.1.a RGPD).

Conservación: según los plazos indicados en las tablas anteriores.

Comunicación de los datos: no se comunicarán datos a terceros, excepto en el caso de las cookies propiedad de terceros recogidas en este documento o por obligación legal.

Puedes retirar tu consentimiento en cualquier momento, ejercer tus derechos de acceso, rectificación, portabilidad y supresión, así como los de limitación y oposición, escribiendo a ${ENTITY.email}, y presentar una reclamación ante la ${DPA.name} (${DPA.url}).`,
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
      updatedAt="2026-09-01"
    />
  );
}
