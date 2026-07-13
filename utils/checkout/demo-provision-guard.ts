/**
 * Guards inline (demo/test) account creation. Real Stripe payments provision via
 * the webhook and are unaffected. The danger this closes: isDemoMode() is
 * auto-true on any Vercel preview/development; a preview that inherited prod
 * SUPABASE_URL/SERVICE_ROLE_KEY would let the anonymous form mint real accounts
 * in the prod DB. So:
 *   - admin HMAC cookie trigger -> trusted, allowed on any DB (incl prod: the
 *     legitimate admin test-mode from Spec 7, rows are is_demo/deletable).
 *   - isDemoMode() trigger (no cookie) -> allowed ONLY against a non-prod ref.
 *   - unknown/garbage url with env trigger -> fail closed (no provision).
 */
export const PROD_SUPABASE_REF = 'jytokoxbsykoyifzbjkd'

export function supabaseRefFromUrl(url: string | undefined): string | null {
  if (!url) return null
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(url)
  return m ? m[1] : null
}

export function canProvisionInline(opts: {
  triggeredByAdminCookie: boolean
  supabaseUrl: string | undefined
}): boolean {
  if (opts.triggeredByAdminCookie) return true
  const ref = supabaseRefFromUrl(opts.supabaseUrl)
  if (!ref) return false // fail closed on unknown env
  return ref !== PROD_SUPABASE_REF
}
