'use client';

import { useEffect } from 'react';

/**
 * Cada cuánto se avisa de que este visitante sigue aquí. Con la ventana de 2
 * minutos de `ONLINE_WINDOW_MS`, hacen falta dos latidos perdidos seguidos para
 * caerse del contador.
 */
export const HEARTBEAT_MS = 45_000;

/**
 * Marca a este visitante como presente mientras tenga la web delante.
 *
 * Va en el layout raíz, así que cuenta toda la web: landing, cursos y área de
 * alumnos. No manda la ruta ni ningún identificador — el servidor solo apunta
 * un hash efímero y la hora, y solo un admin puede leer el total.
 *
 * `keepalive` para que el latido sobreviva a una navegación en curso.
 *
 * Calla con la pestaña oculta: sin esto, quien deja quince pestañas abiertas de
 * fondo contaría quince veces y el número dejaría de significar «gente mirando».
 *
 * NO pasa por el banner de consentimiento: no deja cookies ni guarda datos
 * personales. Si eso cambia, hay que gatearlo y subir CONSENT_VERSION.
 */
export default function PresenceHeartbeat(): null {
  useEffect(() => {
    let stopped = false;

    const ping = (): void => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') return;
      // Sin cuerpo: todo lo que se guarda se deriva en servidor.
      void fetch('/api/presence', { method: 'POST', keepalive: true }).catch(() => {});
    };

    ping();
    const timer = setInterval(ping, HEARTBEAT_MS);
    // Volver a la pestaña vuelve a contar sin esperar al siguiente intervalo.
    document.addEventListener('visibilitychange', ping);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', ping);
    };
  }, []);

  return null;
}
