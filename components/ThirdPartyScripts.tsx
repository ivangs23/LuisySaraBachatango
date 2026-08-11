'use client';

import Script from 'next/script';
import { useConsent } from '@/context/ConsentContext';

/**
 * Scripts de terceros que solo se cargan con su categoría de consentimiento
 * concedida. Fail-closed en dos sentidos: sin decisión guardada no se carga
 * nada, y sin la variable de entorno correspondiente tampoco.
 *
 * Vercel Analytics y Speed Insights NO están aquí — no usan cookies, se
 * montan directamente en el layout.
 */
export default function ThirdPartyScripts() {
  const { state, hydrated } = useConsent();

  if (!hydrated || !state) return null;

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  const loadGa = state.analytics && !!gaId;
  const loadPixel = state.marketing && !!pixelId;

  return (
    <>
      {loadGa && (
        <>
          <Script
            id="ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}

      {loadPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
