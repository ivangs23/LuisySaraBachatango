/**
 * Throws if the Stripe environment looks misconfigured for production.
 * Intentionally LOOSE: in non-production we don't want to crash on
 * test keys (sk_test_..., whsec_test...) or even on missing values.
 *
 * In production we require:
 *  - STRIPE_SECRET_KEY starts with `sk_live_`
 *  - STRIPE_WEBHOOK_SECRET starts with `whsec_` (Stripe webhook secrets are
 *    not prefixed `whsec_live_` — `whsec_` is the only prefix; we just
 *    require it to be present and well-formed)
 *
 * Note: the check is skipped at build time (NEXT_PHASE=phase-production-build)
 * because Next.js pre-imports route handlers during the build with NODE_ENV set
 * to "production" but env vars may not yet be the real production values.
 * The assertion is a runtime safety net, not a build-time gate.
 */
export function assertStripeEnvForProduction(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return

  // Skip during Next.js build phase — env vars are not runtime values yet
  if (env.NEXT_PHASE === 'phase-production-build') return

  const secret = env.STRIPE_SECRET_KEY ?? ''
  const webhook = env.STRIPE_WEBHOOK_SECRET ?? ''

  // Skip if env vars haven't been wired yet (e.g. CI/CD build time)
  if (!secret) return

  if (!secret.startsWith('sk_live_')) {
    throw new Error('STRIPE_SECRET_KEY no es una key live en producción')
  }
  if (!webhook.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET vacío o malformado')
  }
}
