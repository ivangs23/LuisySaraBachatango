import type { TrackedPath } from './tracked-paths';

/**
 * Manda un evento de la landing a `/api/landing-event` (vista de página o
 * evento con ruta virtual, ver `tracked-paths.ts`).
 *
 * `sendBeacon` no bloquea la navegación y sobrevive a que el usuario se vaya.
 * Sin cookies ni datos personales: por eso no pasa por el banner de
 * consentimiento. Si el navegador no tiene `sendBeacon`, no se mide y ya.
 */
export function sendLandingEvent(path: TrackedPath): void {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;

  // Blob con content-type explícito: sendBeacon manda text/plain por defecto
  // y la ruta espera JSON.
  const payload = new Blob([JSON.stringify({ path })], { type: 'application/json' });
  navigator.sendBeacon('/api/landing-event', payload);
}
