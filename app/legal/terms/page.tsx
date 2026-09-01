import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '../_components/LegalShell';
import { ENTITY } from '@/utils/legal/entity';

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
    heading: 'Introducción y aceptación',
    body: `Este documento contractual rige las Condiciones Generales de contratación de cursos de formación, en adelante las Condiciones, a través del sitio web ${ENTITY.domain}, propiedad de ${ENTITY.legalName} bajo la marca comercial ${ENTITY.tradeName}, en adelante el PRESTADOR.

Estas Condiciones permanecerán publicadas en el sitio web a disposición del USUARIO para reproducirlas y guardarlas como confirmación del contrato, pudiendo ser modificadas en cualquier momento por el PRESTADOR. Resultarán aplicables aquellas que se encuentren vigentes en el momento de realizar el pedido, sin que las modificaciones puedan afectar a contrataciones ya formalizadas.

La aceptación de este documento conlleva que el USUARIO ha leído y comprende lo aquí expuesto, es una persona con capacidad suficiente para contratar y asume todas las obligaciones aquí dispuestas.`,
  },
  {
    heading: 'Identidad de las partes',
    body: `Por un lado, el PRESTADOR de los cursos de formación contratados por el USUARIO es ${ENTITY.legalName}, con domicilio en ${ENTITY.addressShort}, NIF ${ENTITY.taxId} y teléfono de atención al USUARIO ${ENTITY.phone}.

Por otro lado, el USUARIO, registrado en el sitio web mediante una dirección de correo electrónico y una contraseña sobre las que tiene responsabilidad plena de uso y custodia, y es responsable de la veracidad de los datos personales facilitados al PRESTADOR. En algunos casos el USUARIO no coincidirá con el ALUMNO, por lo que actuará por cuenta de este.`,
  },
  {
    heading: 'Objeto del contrato',
    body: `El presente contrato tiene por objeto regular la relación contractual de compraventa nacida entre el PRESTADOR y el USUARIO en el momento en que este acepta, durante el proceso de contratación en línea, la casilla correspondiente.

La relación contractual conlleva la entrega, a cambio de un precio determinado y públicamente expuesto a través del sitio web, de un curso de formación concreto en formato digital.`,
  },
  {
    heading: 'Procedimiento de contratación',
    body: `Para acceder a los servicios que ofrece el PRESTADOR, el USUARIO deberá ser mayor de 16 años y darse de alta a través del sitio web mediante la creación de una cuenta. Para ello deberá proporcionar de manera libre y voluntaria los datos personales que se le requieran, que se tratarán conforme a lo detallado en el Aviso legal y en la Política de privacidad de este sitio web.

El USUARIO seleccionará una contraseña, comprometiéndose a hacer un uso diligente de la misma y a no ponerla a disposición de terceros, así como a comunicar al PRESTADOR su pérdida o robo, o el posible acceso por un tercero no autorizado, de manera que este proceda al bloqueo inmediato.

Conforme a lo que exige el artículo 27 de la LSSICE, el procedimiento de contratación seguirá los pasos descritos en las cláusulas siguientes de este documento.`,
  },
  {
    heading: 'Activación del servicio',
    body: `El PRESTADOR no activará ningún servicio hasta que haya comprobado que se ha realizado el pago.

Como el pedido no conlleva la entrega física de ningún producto, siendo los servicios contratados activados directamente desde el sitio web, el PRESTADOR informa al USUARIO de que el acceso se habilita de forma automática al confirmarse el pago, momento en el que recibirá sus datos de acceso.

El acceso a la formación en línea es estrictamente privado. La transmisión de las credenciales de acceso a un tercero está prohibida. El USUARIO acepta no ceder, de forma gratuita u onerosa, el acceso a terceros bajo ninguna circunstancia.

El PRESTADOR no asumirá responsabilidad alguna cuando la activación del curso no llegue a realizarse por ser los datos facilitados por el USUARIO falsos, inexactos o incompletos.`,
  },
  {
    heading: 'Falta de ejecución del contrato a distancia',
    body: `En caso de no poder ejecutar el contrato porque el servicio contratado no esté disponible en el plazo previsto, se informará al USUARIO de la falta de disponibilidad y de que queda legitimado para cancelar el pedido y recibir la devolución del importe total pagado sin ningún coste, sin que por ello se derive ninguna responsabilidad por daños y perjuicios imputable al PRESTADOR.

En caso de retraso injustificado por parte del PRESTADOR respecto a la devolución del importe total, el USUARIO podrá reclamar que se le pague el doble del importe adeudado, sin perjuicio de su derecho a ser indemnizado por los daños y perjuicios sufridos en lo que excedan de dicha cantidad.`,
  },
  {
    heading: 'Derecho de desistimiento',
    body: `Con carácter general, el USUARIO dispone de un plazo de catorce días naturales, contados desde la celebración del contrato, para ejercer el derecho de desistimiento regulado en el artículo 102 del Real Decreto Legislativo 1/2007, de 16 de noviembre, por el que se aprueba el texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios, en adelante RDL 1/2007.

No obstante, el artículo 103.m del RDL 1/2007 excluye del derecho de desistimiento el suministro de contenido digital que no se preste en un soporte material cuando la ejecución haya comenzado con el consentimiento previo y expreso del consumidor y con su conocimiento de que, en consecuencia, pierde su derecho de desistimiento.

Por este motivo, durante el proceso de compra el USUARIO debe marcar una casilla específica e independiente mediante la que solicita expresamente el acceso inmediato al contenido digital y reconoce que, al comenzar la ejecución, pierde su derecho de desistimiento. El PRESTADOR conserva constancia de dicha aceptación, con su fecha. Una vez habilitado el acceso, la compra no admite devoluciones.

Si el USUARIO no presta ese consentimiento, no se habilitará el acceso inmediato y conservará íntegramente su derecho de desistimiento durante los catorce días naturales.

Si el PRESTADOR no cumpliera con el deber de información y documentación sobre el derecho de desistimiento, el plazo para su ejercicio finalizaría doce meses después de la fecha de expiración del período inicial, conforme al artículo 105 del RDL 1/2007.

Formulario de desistimiento: https://${ENTITY.domain}/formulario-solicitud-desistimiento.pdf

Toda solicitud deberá comunicarse al PRESTADOR mediante el formulario habilitado o por correo electrónico a ${ENTITY.email}, indicando el número de factura o pedido correspondiente.`,
  },
  {
    heading: 'Reclamaciones',
    body: `Cualquier reclamación que el USUARIO considere oportuna será atendida a la mayor brevedad posible, y podrá realizarse en las siguientes direcciones de contacto:

Correo postal: ${ENTITY.legalName}, ${ENTITY.addressShort}.

Teléfono: ${ENTITY.phone}.

Correo electrónico: ${ENTITY.email}.

El USUARIO puede solicitar asimismo las hojas oficiales de reclamación de la Junta de Extremadura y dirigirse a los organismos de consumo competentes.`,
  },
  {
    heading: 'Precio y plazo de validez de la oferta',
    body: `Los precios indicados respecto de cada servicio incluyen el Impuesto sobre el Valor Añadido (IVA) u otros impuestos que pudieran ser aplicables, y se expresan en euros.

Antes de realizar la compra, el USUARIO podrá comprobar en línea todos los detalles del pedido: curso, precio, impuestos y total. Los precios pueden variar mientras no se haya realizado el pedido; una vez realizado, el precio se mantiene.

Todo pago realizado al PRESTADOR conlleva la emisión de una factura a nombre del USUARIO registrado. Para cualquier información sobre el pedido, el USUARIO podrá contactar en el teléfono ${ENTITY.phone} o en ${ENTITY.email}.`,
  },
  {
    heading: 'Formas de pago y seguridad',
    body: `El pago del pedido se efectúa mediante tarjeta de crédito o débito a través de una pasarela de pago segura. El PRESTADOR no almacena en ningún momento los datos completos de tu tarjeta.

El sitio web utiliza técnicas de seguridad de la información generalmente aceptadas en la industria, tales como el cifrado de las comunicaciones, la introducción de los datos en página segura, cortafuegos, procedimientos de control de acceso y mecanismos criptográficos, todo ello con el objeto de evitar el acceso no autorizado a los datos.

El PRESTADOR se compromete a no permitir ninguna transacción que sea considerada ilegal por las marcas de tarjetas o por la entidad adquirente.

Los precios publicados no incluyen gastos de envío, al tratarse de un producto digital que no conlleva entrega física.`,
  },
  {
    heading: 'Proceso de compra',
    body: `Desde la página del curso se puede formalizar un pedido siguiendo estos pasos: comprobación de los datos de facturación, comprobación del método de prestación del curso, aceptación de las presentes Condiciones y del consentimiento de ejecución inmediata, selección de la forma de pago y realización del pedido.

Una vez procesado el pedido, el sistema envía un correo electrónico al USUARIO confirmando la compra y el acceso al curso.

En caso de controversias relativas a la naturaleza de los servicios del PRESTADOR o al uso que el USUARIO haga del sitio web, la información registrada en el dispositivo de pago electrónico podrá utilizarse como prueba entre ambas partes.`,
  },
  {
    heading: 'Propiedad intelectual del contenido formativo',
    body: `Todo el contenido publicado en este sitio —textos, gráficos, logotipos, vídeos, música, coreografías y materiales descargables— es propiedad del PRESTADOR o de sus licenciantes, y queda protegido por la legislación nacional e internacional de propiedad intelectual.

La compra concede al USUARIO una licencia personal, intransferible y no exclusiva para acceder al contenido. Queda prohibida su reproducción, distribución, comunicación pública o transformación sin autorización escrita previa. Se excluye expresamente toda transferencia de propiedad desde el PRESTADOR hacia el USUARIO.

Está igualmente prohibido compartir las credenciales de acceso o redistribuir el contenido formativo por cualquier medio.`,
  },
  {
    heading: 'Continuidad y calidad del servicio',
    body: `El PRESTADOR se compromete a actuar con la mayor diligencia posible para suministrar un servicio de calidad conforme a las prácticas generalmente reconocidas, ofreciendo el acceso a la formación las 24 horas del día, todos los días de la semana, condicionado a las circunstancias de suministro y al rendimiento de la red.

El PRESTADOR se reserva el derecho a interrumpir el servicio con el fin de llevar a cabo el mantenimiento esencial o mejorar el rendimiento, informando al USUARIO con antelación razonable siempre que sea posible.

El USUARIO reconoce que la formación puede no estar disponible si él mismo no puede acceder a Internet o a este sitio web, sin que el PRESTADOR sea responsable por ello. Corresponde al USUARIO mantener actualizado su navegador y su propia protección frente a software malicioso.

Si la formación fuera suspendida a raíz de la decisión de una autoridad competente, el PRESTADOR reembolsará al USUARIO o le ofrecerá un crédito válido por un año, igual al importe de dicha oferta formativa.`,
  },
  {
    heading: 'Obligaciones del USUARIO',
    body: `El USUARIO acepta haber verificado la compatibilidad entre su demanda y la oferta de servicios, y reconoce haber recibido la información necesaria para que el presente acuerdo entre en vigor con pleno conocimiento.

El USUARIO se compromete a utilizar los servicios únicamente con fines legítimos y conforme a lo recogido en este documento, y a informar al ALUMNO de estos términos cuando no coincidan ambas figuras.

El PRESTADOR podrá suspender o terminar el acceso del USUARIO a sus servicios, en su totalidad o en parte, por cualquier razón válida, incluyendo el incumplimiento de las obligaciones establecidas en este documento o de cualquier disposición legal aplicable. El ejercicio de esta facultad no perjudica ni afecta al ejercicio de cualquier otro derecho o recurso que corresponda al PRESTADOR.`,
  },
  {
    heading: 'Servicio posventa y validación de la formación',
    body: `El PRESTADOR se compromete a proporcionar al USUARIO la ayuda necesaria en lo que respecta a la formación adquirida. Puede contactarnos para cualquier petición relacionada con el curso en ${ENTITY.email}.

La formación se considera validada cuando el ALUMNO ha superado las evaluaciones que se le presentan en el desarrollo del curso, en cuyo caso se le enviará un diploma acreditativo de los conocimientos adquiridos.

Este diploma es una acreditación privada expedida por la escuela y no constituye un título con validez académica oficial ni habilita profesionalmente para el ejercicio de actividad regulada alguna.`,
  },
  {
    heading: 'Garantías, fuerza mayor y nulidad parcial',
    body: `Las garantías responderán a lo regulado en el título referido a garantías y servicios posventa del RDL 1/2007.

Las partes no incurrirán en responsabilidad ante cualquier falta debida a causa mayor. El cumplimiento de la obligación se demorará hasta el cese del caso de fuerza mayor.

Si alguna estipulación de estas Condiciones fuera considerada nula o de imposible cumplimiento, la validez, legalidad y cumplimiento del resto no se verán afectados de ninguna manera.

El USUARIO no podrá ceder, transferir ni transmitir los derechos, responsabilidades y obligaciones contratados.`,
  },
  {
    heading: 'Ley aplicable y jurisdicción',
    body: `Estas Condiciones se regirán e interpretarán conforme a la legislación española en aquello que no esté expresamente establecido.

El PRESTADOR y el USUARIO acuerdan someter a los juzgados y tribunales del domicilio del USUARIO cualquier controversia que pudiera suscitarse de la prestación de los servicios objeto de estas Condiciones.

En caso de que el USUARIO tenga su domicilio fuera de España, será igualmente competente la jurisdicción del país de residencia del consumidor cuando así lo determine la normativa europea aplicable, sin perjuicio de que ambas partes puedan acudir voluntariamente a una entidad de resolución alternativa de litigios de consumo.`,
  },
];

export default function TermsPage() {
  return (
    <LegalShell
      chapter="DOCUMENTO 02"
      eyebrow="CONDICIONES · CONTRATACIÓN"
      title="Términos y Condiciones"
      intro="Las reglas del juego. Aquí explicamos qué esperamos de quienes utilizan la plataforma y qué puedes esperar de nosotros como escuela y servicio digital."
      sections={SECTIONS}
      updatedAt="2026-09-01"
    />
  );
}
