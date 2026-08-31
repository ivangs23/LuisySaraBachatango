'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { normalisePath } from '@/utils/analytics/tracked-paths';

/**
 * Manda una vista de página a `/api/landing-event` al entrar en una ruta medida.
 *
 * Por qué en cliente y no en servidor: `/` y `/curso-bachatango` se sirven con
 * ISR, así que el componente de servidor se ejecuta una vez cada cinco minutos
 * aunque entren mil personas. Contar ahí perdería casi todo.
 *
 * Por qué no en el middleware: ya refresca la sesión de Supabase en cada
 * petición y está optimizado para saltárselo en tráfico anónimo. Añadirle una
 * escritura desharía esa optimización en TODAS las rutas, no solo las medidas.
 *
 * `sendBeacon` no bloquea la navegación y sobrevive a que el usuario se vaya.
 *
 * NO pasa por el banner de consentimiento: no deja cookies ni guarda datos
 * personales. Si eso cambia, hay que gatearlo y subir CONSENT_VERSION.
 */
export default function LandingAnalytics(): null {
  const pathname = usePathname();
  // React 19 en modo estricto monta dos veces en desarrollo; sin esto cada
  // visita contaría doble.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    const path = normalisePath(pathname);
    if (!path) return;
    if (lastSent.current === path) return;
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;

    lastSent.current = path;

    // Blob con content-type explícito: sendBeacon manda text/plain por defecto
    // y la ruta espera JSON.
    const payload = new Blob([JSON.stringify({ path })], { type: 'application/json' });
    navigator.sendBeacon('/api/landing-event', payload);
  }, [pathname]);

  return null;
}
