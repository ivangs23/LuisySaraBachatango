export type PlanType = '1month' | '6months' | '1year'

// TODO(admin): replace zeros with the real € prices charged by Stripe for each plan
// WHEN subscriptions are re-enabled (decisión 2026-07: aparcadas por ahora).
// These values feed the MRR calculation shown on /admin; while they are 0 the
// MRR line is hidden in app/admin/page.tsx to avoid showing a misleading €0.
// NOTA (AUDITORIA-2026-07 M5): antes de reactivar suscripciones hay que subir
// el apiVersion pin de utils/stripe/server.ts a basil — ver plan de implementación 2.4.
export const PLAN_PRICES_EUR: Record<PlanType, number> = {
  '1month': 0,
  '6months': 0,
  '1year': 0,
}

export function monthlyEquivalent(plan: PlanType, totalEur: number): number {
  switch (plan) {
    case '1month': return totalEur
    case '6months': return totalEur / 6
    case '1year': return totalEur / 12
    default: return 0
  }
}
