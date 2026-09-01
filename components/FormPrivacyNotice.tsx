import { ENTITY, DPA } from '@/utils/legal/entity'
import styles from './FormPrivacyNotice.module.css'

/**
 * Información básica de protección de datos que debe acompañar a TODO
 * formulario que recoja datos personales (art. 13 RGPD).
 *
 * Es la "capa 1" del modelo por capas que recomienda la AEPD: lo esencial
 * junto al campo donde se escriben los datos, con enlace a la política
 * completa. Informar solo en la política de privacidad no cumple: hay que
 * hacerlo en el momento de la recogida.
 *
 * Cada formulario declara su propia finalidad y base jurídica, porque no
 * coinciden: el boletín se apoya en el consentimiento y el contacto en la
 * atención de la solicitud.
 */
type Props = {
  /** Para qué se usan los datos de ESTE formulario. */
  purpose: string
  /** Base jurídica de ESTE tratamiento, con su artículo. */
  legalBasis: string
}

export default function FormPrivacyNotice({ purpose, legalBasis }: Props) {
  return (
    <details className={styles.wrap}>
      <summary className={styles.summary}>Información básica sobre protección de datos</summary>
      <dl className={styles.list}>
        <dt>Responsable</dt>
        <dd>{ENTITY.legalName} (NIF {ENTITY.taxId})</dd>

        <dt>Finalidad</dt>
        <dd>{purpose}</dd>

        <dt>Legitimación</dt>
        <dd>{legalBasis}</dd>

        <dt>Destinatarios</dt>
        <dd>
          No se comunican datos a terceros, salvo a los proveedores que actúan como
          encargados del tratamiento o por obligación legal.
        </dd>

        <dt>Derechos</dt>
        <dd>
          Acceso, rectificación, portabilidad y supresión, así como limitación y
          oposición, escribiendo a {ENTITY.email}. También puedes reclamar ante la{' '}
          {DPA.name} ({DPA.url}).
        </dd>

        <dt>Más información</dt>
        <dd>
          <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">
            Política de privacidad
          </a>
        </dd>
      </dl>
    </details>
  )
}
