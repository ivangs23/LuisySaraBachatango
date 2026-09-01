import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '../_components/LegalShell';
import { ENTITY, DPA } from '@/utils/legal/entity';

export const metadata: Metadata = {
  title: 'Política de Privacidad en Redes Sociales',
  description:
    'Cómo tratamos tus datos personales cuando interactúas con los perfiles oficiales de Luis y Sara Bachatango en redes sociales.',
  openGraph: {
    title: 'Política de Privacidad en Redes Sociales | Luis y Sara Bachatango',
    url: '/legal/redes-sociales',
  },
  alternates: { canonical: '/legal/redes-sociales' },
  robots: { index: true, follow: false },
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'Responsable del tratamiento',
    body: `${ENTITY.legalName}, en adelante el RESPONSABLE, informa al USUARIO de que ha procedido a crear perfiles oficiales en las redes sociales que se enlazan desde este sitio web —Instagram, Facebook, YouTube y TikTok—, y de que es el responsable del tratamiento de los datos personales que se lleve a cabo en dichas redes.

Estos datos serán tratados de conformidad con lo dispuesto en el Reglamento (UE) 2016/679, de 27 de abril (RGPD), y la Ley Orgánica 3/2018, de 5 de diciembre (LOPDGDD).`,
    bullets: [
      `Denominación: ${ENTITY.legalName}`,
      `NIF: ${ENTITY.taxId}`,
      `Domicilio: ${ENTITY.address}`,
      `Correo electrónico: ${ENTITY.email}`,
    ],
  },
  {
    heading: 'Para qué tratamos tus datos',
    body: `El fin del tratamiento es mantener una relación entre el USUARIO y el RESPONSABLE, que puede incluir las siguientes operaciones:`,
    bullets: [
      'Tramitar solicitudes y consultas planteadas al responsable.',
      'Informar sobre actividades y eventos organizados por el responsable.',
      'Informar sobre productos o servicios ofrecidos por el responsable.',
      'Interactuar a través de los perfiles oficiales.',
    ],
  },
  {
    heading: 'Por qué podemos tratarlos',
    body: `La base jurídica del tratamiento es el artículo 6.1.a del RGPD: el interesado ha dado su consentimiento para el tratamiento de sus datos personales para uno o varios fines específicos.

El USUARIO dispone de un perfil en la propia red social y ha decidido unirse a la del RESPONSABLE, mostrando así interés en la información que se publique en ella. Por tanto, en el momento de solicitar seguir nuestros perfiles oficiales, nos facilita su consentimiento para el tratamiento de aquellos datos personales publicados en su perfil.

El RESPONSABLE accede y trata únicamente la información pública del USUARIO, en especial su nombre de contacto. Estos datos solo se utilizan dentro de la propia red social y únicamente se incorporarán a un fichero del RESPONSABLE cuando sea necesario para tramitar la petición del USUARIO.

El USUARIO puede acceder en todo momento a las políticas de privacidad de la propia red social, así como configurar su perfil para garantizar su privacidad.`,
  },
  {
    heading: 'Durante cuánto tiempo los guardamos',
    body: `Los datos se conservarán mientras el USUARIO no revoque el consentimiento prestado, tal y como se indica en esta política.`,
  },
  {
    heading: 'A quién comunicamos tus datos',
    body: `La información facilitada por el USUARIO a través de las redes sociales del RESPONSABLE, incluidos sus datos personales, puede ser publicada —siempre en función de los servicios que el USUARIO utilice—, por lo que podrá quedar a disposición pública de otros usuarios de las redes sociales.

Desde el perfil de cada red social, el USUARIO puede configurar qué información quiere hacer pública en cada caso, ver los permisos concedidos, eliminarlos o desactivarlos, como con cualquier aplicación de un tercero que ya no desee utilizar.

No está prevista ninguna comunicación de datos personales a terceros fuera de la red social, salvo que resulte imprescindible para el desarrollo y ejecución de las finalidades del tratamiento, a nuestros proveedores de servicios relacionados con comunicaciones, con los cuales el RESPONSABLE tiene suscritos los contratos de confidencialidad y de encargado de tratamiento exigidos por la normativa vigente.`,
  },
  {
    heading: 'Utilización del perfil',
    body: `El RESPONSABLE podrá realizar las siguientes actuaciones:`,
    bullets: [
      'Acceder a la información pública del perfil.',
      'Publicar en el perfil del USUARIO aquella información ya publicada en la red social del RESPONSABLE.',
      'Enviar mensajes personales e individuales a través de los canales de la red social.',
      'Publicar actualizaciones del estado de la página en el perfil del USUARIO.',
    ],
  },
  {
    heading: 'Publicaciones de los usuarios',
    body: `El USUARIO, una vez sea seguidor o se haya unido a la red social del RESPONSABLE, podrá publicar comentarios, enlaces, imágenes, fotografías o cualquier otro contenido multimedia soportado por la misma. En todos los casos el USUARIO debe ser el titular del contenido publicado, gozar de los derechos de autor y de propiedad intelectual, o contar con el consentimiento de los terceros afectados.

Se prohíbe expresamente cualquier publicación —textos, gráficos, fotografías, vídeos u otros— que atente o sea susceptible de atentar contra la moral, la ética, el buen gusto o el decoro, o que infrinja los derechos de propiedad intelectual o industrial, el derecho a la imagen o la Ley. En estos casos el RESPONSABLE se reserva el derecho a retirar de inmediato el contenido, sin comunicación previa, pudiendo solicitar el bloqueo permanente del USUARIO.

El RESPONSABLE no se hará responsable de los contenidos que libremente haya publicado un USUARIO. El USUARIO debe tener presente que sus publicaciones serán conocidas por otros usuarios, por lo que él mismo es el principal responsable de su privacidad.

Las imágenes que puedan publicarse en la red social no serán almacenadas en ningún fichero por parte del RESPONSABLE, pero sí permanecerán en la red social.`,
  },
  {
    heading: 'Menores de edad y personas con capacidades especiales',
    body: `El acceso y registro a través de las redes sociales del RESPONSABLE está prohibido a menores de 14 años, conforme al artículo 7 de la LOPDGDD.

Si el USUARIO tiene capacidades especiales, será necesaria la intervención del titular de su patria potestad o tutela, o de su representante legal, mediante documento válido que acredite la representación.

El RESPONSABLE queda expresamente exonerado de cualquier responsabilidad que pudiera derivarse del uso de las redes sociales por parte de menores o personas con capacidades especiales. Las redes sociales del RESPONSABLE no recogen conscientemente información personal de menores de edad; por ello, si el USUARIO es menor de edad, no debe registrarse ni utilizar dichas redes, ni proporcionar información personal alguna.`,
  },
  {
    heading: 'Tus derechos',
    body: `Los derechos que asisten al USUARIO solo podrán satisfacerse en relación con aquella información que se encuentre bajo el control del RESPONSABLE. Respecto del resto, deberá dirigirse a la propia red social.`,
    bullets: [
      'Retirar el consentimiento en cualquier momento.',
      'Acceso, rectificación, portabilidad y supresión de tus datos.',
      'Limitación y oposición a su tratamiento.',
      `Presentar una reclamación ante la ${DPA.name} (${DPA.url}) si consideras que el tratamiento no se ajusta a la normativa vigente.`,
    ],
  },
  {
    heading: 'Cómo ejercer tus derechos',
    body: `Dirígete al RESPONSABLE por cualquiera de estos medios, indicando el derecho que deseas ejercer:

Correo postal: ${ENTITY.legalName}, ${ENTITY.addressShort}.

Correo electrónico: ${ENTITY.email}.`,
  },
];

export default function SocialMediaPrivacyPage() {
  return (
    <LegalShell
      chapter="DOCUMENTO 05"
      eyebrow="PRIVACIDAD · REDES SOCIALES"
      title="Privacidad en Redes Sociales"
      intro="Cuando sigues nuestros perfiles o interactúas con nosotros en redes sociales, el tratamiento de tus datos es distinto al de la web. Este documento explica qué información vemos, para qué la usamos y qué puedes exigirnos."
      sections={SECTIONS}
      updatedAt="2026-09-01"
    />
  );
}
