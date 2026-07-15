'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isChromelessRoute } from '@/utils/nav/chromeless-routes';

/**
 * Minimal legal footer for the chromeless sales funnel (landing + checkout +
 * gracias). The global Header/Footer are hidden on these routes, but LSSI/GDPR
 * require the legal notice, privacy and cookies to stay reachable while the
 * buyer enters payment-adjacent PII. Renders ONLY on the funnel routes.
 */
export default function FunnelLegalFooter() {
  const pathname = usePathname();
  if (!isChromelessRoute(pathname)) return null;

  return (
    <footer
      style={{
        textAlign: 'center',
        padding: '1.25rem 1rem 2rem',
        fontSize: '0.78rem',
        lineHeight: 1.6,
        color: '#8a8a8a',
      }}
    >
      <nav
        aria-label="Enlaces legales"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.9rem', justifyContent: 'center', marginBottom: '0.4rem' }}
      >
        <Link href="/legal/notice" style={{ color: 'inherit', textDecoration: 'underline' }}>Aviso legal</Link>
        <Link href="/legal/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacidad</Link>
        <Link href="/legal/cookies" style={{ color: 'inherit', textDecoration: 'underline' }}>Cookies</Link>
        <Link href="/legal/terms" style={{ color: 'inherit', textDecoration: 'underline' }}>Términos</Link>
      </nav>
      <p style={{ margin: 0 }}>
        © Luis y Sara Bachatango · Pago seguro con Stripe · Producto digital, pago único sin devoluciones
      </p>
    </footer>
  );
}
