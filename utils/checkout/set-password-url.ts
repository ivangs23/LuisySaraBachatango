/**
 * Enlace de «Crea tu contraseña» del correo de compra, a partir del
 * `hashed_token` de `auth.admin.generateLink({ type: 'recovery' })`.
 *
 * Pasa por `/auth/confirm` y no por el `action_link` de Supabase: ver por qué en
 * app/auth/confirm/route.ts. Lo usan el aprovisionamiento tras el pago y el
 * reenvío manual de `/admin/correos`, que tienen que dar el mismo enlace.
 */
export function setPasswordUrl(hashedToken: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'
  return `${base}/auth/confirm?token_hash=${hashedToken}&type=recovery&next=/reset-password`
}
