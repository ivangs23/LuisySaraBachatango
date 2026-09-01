/**
 * Identidad de la entidad titular, tal y como debe figurar en los textos
 * legales (LSSICE art. 10, RGPD art. 13).
 *
 * Fuente: pack de textos legales revisado el 1 de septiembre de 2026, que
 * sustituyó al titular anterior (persona física) por la entidad actual.
 *
 * Existe como módulo único porque estos datos se repiten en los cinco
 * documentos legales: tenerlos duplicados en cada página es cómo se acaba
 * publicando un NIF viejo en una de ellas.
 */

export const ENTITY = {
  /** Denominación de la entidad. ESPJ = entidad sin personalidad jurídica. */
  legalName: 'LS ESCUELA DE BAILES ESPJ.',
  tradeName: 'LUIS Y SARA BACHATANGO',
  taxId: 'E09928052',
  address: 'CALLE GANADEROS, 18 - 06200 ALMENDRALEJO (Badajoz), España',
  /** Versión corta para intercalar en prosa. */
  addressShort: 'CALLE GANADEROS, 18 - 06200 ALMENDRALEJO (Badajoz)',
  phone: '+34 657 56 54 48',
  domain: 'luisysarabachatango.com',

  /**
   * Canal único de contacto para privacidad, ejercicio de derechos,
   * reclamaciones y contratación.
   *
   * El pack legal traía dos direcciones distintas (mancasyg@gmail.com para
   * privacidad y luismontero0132@gmail.com para aviso legal y reclamaciones)
   * y el propio revisor pedía unificarlas: dos canales para lo mismo se
   * contradicen entre sí y complican demostrar que se atendió un derecho.
   *
   * Cambiarla aquí actualiza los cinco documentos legales y los avisos de los
   * formularios a la vez.
   */
  email: 'luisysarabachatango@gmail.com',
} as const

/** Autoridad de control competente en materia de protección de datos. */
export const DPA = { name: 'Agencia Española de Protección de Datos', url: 'www.aepd.es' } as const
