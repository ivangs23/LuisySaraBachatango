export type PlanType = '1month' | '6months' | '1year'

// TODO(admin): replace zeros with the real € prices charged by Stripe for each plan.
// These values feed the MRR calculation shown on /admin.
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
