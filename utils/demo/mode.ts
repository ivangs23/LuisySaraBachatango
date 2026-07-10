/**
 * Modo demo: simula el pago (sin Stripe) para probar a mano. AUTOMÁTICO por
 * entorno — NO requiere ninguna env var:
 *   - Producción (VERCEL_ENV='production' o dominio prod real) → modo producción
 *     (Stripe real).
 *   - Preview / development / local → modo demo (pago simulado).
 *   - Cualquier VERCEL_ENV desconocido → producción (fail-safe).
 *
 * OJO: en modo demo se escriben datos REALES (usuarios, compras, invitaciones)
 * en la BD Supabase a la que apunte el entorno (preview/local usan sus
 * variables SUPABASE_*).
 */
export function isDemoMode(): boolean {
  const vEnv = process.env.VERCEL_ENV;
  // Allowlist: solo local (undefined) o preview/development son demo.
  // 'production' o cualquier valor desconocido → producción.
  if (vEnv && vEnv !== 'preview' && vEnv !== 'development') return false;
  // Segundo guard: el dominio de producción real nunca es demo.
  if ((process.env.NEXT_PUBLIC_BASE_URL ?? '').includes('luisysarabachatango.com')) return false;
  return true;
}
