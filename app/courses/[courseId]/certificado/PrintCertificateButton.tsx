'use client';

import { Printer } from 'lucide-react';
import styles from './certificate.module.css';

/**
 * Único trozo de cliente de la página: `window.print()` no existe en servidor.
 * El propio botón desaparece en la impresión (`.actions` lleva display:none en
 * @media print), así que no sale en el PDF.
 */
export default function PrintCertificateButton({ label }: { label: string }) {
  return (
    <button type="button" className={styles.printButton} onClick={() => window.print()}>
      <Printer size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
