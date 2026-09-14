import styles from './OfferPrice.module.css';

/**
 * Precio de venta con su "antes" tachado y, opcionalmente, el aviso de plazas.
 *
 * Presentacional a propósito: no lee la BD ni el diccionario. Los textos ya
 * traducidos los pasa quien lo renderiza, que en unos sitios es un Server
 * Component (landing, con `copy.ts` resuelto por cookie) y en otros un Client
 * Component (`useLanguage()`). Así sirve para los dos sin duplicarse.
 *
 * El número tachado es decorativo: el importe que se cobra es siempre `price`.
 */
export interface OfferPriceProps {
  /** Precio real, el que cobra Stripe. */
  price: number;
  /** Precio anterior ya validado por `buildOffer()`. null = no se tacha nada. */
  compareAt?: number | null;
  /** Texto de plazas ya interpolado ("Quedan 5 plazas"). null = no se muestra. */
  spotsText?: string | null;
  /** Etiqueta sólo para lectores de pantalla del número tachado. */
  compareAtLabel?: string;
  /** Descuento a mostrar en píldora (21 → "-21 %"). null = sin píldora. */
  discountPct?: number | null;
  /** `€119` (prefix, estilo de la landing) o `119 €` (suffix, estilo de la home). */
  currency?: 'prefix' | 'suffix';
  size?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center';
  className?: string;
}

export default function OfferPrice({
  price,
  compareAt = null,
  spotsText = null,
  compareAtLabel = 'Antes',
  discountPct = null,
  currency = 'suffix',
  size = 'md',
  align = 'start',
  className,
}: OfferPriceProps) {
  const fmt = (amount: number) => (currency === 'prefix' ? `€${amount}` : `${amount} €`);
  const classes = [styles.wrap, styles[size], align === 'center' ? styles.center : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <p className={styles.row}>
        {compareAt !== null && (
          <span className={styles.compare}>
            <span className="sr-only">{compareAtLabel}: </span>
            <s>{fmt(compareAt)}</s>
          </span>
        )}
        <span className={styles.price}>{fmt(price)}</span>
        {discountPct !== null && discountPct > 0 && (
          <span className={styles.discount}>-{discountPct}&nbsp;%</span>
        )}
      </p>
      {spotsText && (
        <p className={styles.spots}>
          <span className={styles.dot} aria-hidden="true" />
          {spotsText}
        </p>
      )}
    </div>
  );
}
