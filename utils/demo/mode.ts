/**
 * Modo demo: simula el pago (sin Stripe) para probar a mano. Se controla con
 * la env var DEMO_MODE. Doble guard: NUNCA activo en producción real, aunque
 * DEMO_MODE esté a 'true'. Pensado para deploys preview o local.
 */
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE !== 'true') return false;
  const vEnv = process.env.VERCEL_ENV;
  // Allowlist: solo local (undefined) o preview/development. Cualquier otro valor
  // (incluido 'production' o uno desconocido) desactiva el demo.
  if (vEnv && vEnv !== 'preview' && vEnv !== 'development') return false;
  if ((process.env.NEXT_PUBLIC_BASE_URL ?? '').includes('luisysarabachatango.com')) return false;
  return true;
}
