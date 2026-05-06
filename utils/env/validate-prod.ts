/**
 * Throws if required production env vars are missing or malformed.
 * Called once at module load by webhook + login actions to fail loud
 * during the FIRST production runtime invocation rather than silently.
 *
 * Guards:
 *   - No-op outside production.
 *   - No-op during Next build (NEXT_PHASE phase-production-build).
 */
export function assertProdEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return
  if (env.NEXT_PHASE === 'phase-production-build') return

  const errors: string[] = []

  if (!env.NEXT_PUBLIC_BASE_URL || !/^https:\/\//.test(env.NEXT_PUBLIC_BASE_URL)) {
    errors.push('NEXT_PUBLIC_BASE_URL must be set to https://...')
  }

  const stripeSecret = env.STRIPE_SECRET_KEY ?? ''
  if (!stripeSecret.startsWith('sk_live_')) {
    errors.push('STRIPE_SECRET_KEY must be a live key in production')
  }

  const stripeWebhook = env.STRIPE_WEBHOOK_SECRET ?? ''
  if (!stripeWebhook.startsWith('whsec_')) {
    errors.push('STRIPE_WEBHOOK_SECRET is missing or malformed')
  }

  if (errors.length) {
    throw new Error(`Production env invalid:\n  - ${errors.join('\n  - ')}`)
  }
}
