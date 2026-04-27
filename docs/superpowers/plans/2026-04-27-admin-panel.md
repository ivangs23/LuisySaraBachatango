# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a back-office admin area at `/admin` with sidebar navigation, KPI overview, students management (list + detail + actions), dedicated analytics, and moderation views — without touching the existing student `/dashboard`.

**Architecture:** New `/admin/*` route tree with a Server Component layout that enforces `role === 'admin'` and renders an `AdminSidebar` shell. Data fetching is centralized in `utils/admin/queries.ts` (uses the existing `createSupabaseAdmin()` service-role helper at `utils/supabase/admin.ts`); pure calculators live in `utils/admin/metrics.ts`. Mutating server actions live next to the routes (`app/admin/alumnos/actions.ts`) and each calls a `requireAdmin()` guard before touching the DB.

**Tech Stack:**
- Next.js 16 App Router (Server Components + server actions)
- Supabase (`@supabase/ssr` for user sessions, `@supabase/supabase-js` with service role for admin queries)
- Recharts (new dependency) for charts
- CSS Modules (no Tailwind, no Shadcn — coherent with existing style)
- Vitest for unit/component tests; jsdom for component tests under `__tests__/components/**`

**Spec:** `docs/superpowers/specs/2026-04-27-admin-panel-design.md`

---

## File Structure

**New files (created):**

```
utils/admin/
  guard.ts                       # requireAdmin() helper
  guard.test.ts                  # (lives under __tests__/unit/)
  metrics.ts                     # MRR, monthly groupings, distributions
  queries.ts                     # service-role data fetchers
  plan-prices.ts                 # canonical € price per plan_type (MRR base)

app/admin/
  layout.tsx                     # role guard + sidebar shell
  layout.module.css
  page.tsx                       # overview
  page.module.css
  alumnos/page.tsx               # list
  alumnos/[id]/page.tsx          # detail
  alumnos/actions.ts             # role/access/notify/delete
  alumnos/alumnos.module.css
  estadisticas/page.tsx
  estadisticas/estadisticas.module.css
  entregas/page.tsx
  cursos/page.tsx
  comunidad/page.tsx

components/admin/
  AdminSidebar.tsx               # client (usePathname for active state)
  AdminSidebar.module.css
  AdminKpiCard.tsx               # presentational
  AdminKpiCard.module.css
  AdminRevenueChart.tsx          # client (Recharts)
  AdminRevenueChart.module.css
  charts/
    IncomeByMonthChart.tsx
    StudentSignupsChart.tsx
    ActiveSubsChart.tsx
    TopCoursesChart.tsx
    PlanDistributionChart.tsx
    EngagementChart.tsx
    ChartShell.tsx               # shared <ResponsiveContainer> wrapper + empty state
    charts.module.css
  StudentsTable.tsx              # client (sort/click)
  StudentsTable.module.css
  StudentsToolbar.tsx            # client (search/filter)
  StudentDetail/
    StudentSummaryCard.tsx       # left column ficha
    StudentTabs.tsx              # client tabs container
    TabCursos.tsx
    TabProgreso.tsx
    TabEntregas.tsx
    TabComunidad.tsx
    TabPagos.tsx
    StudentActions.tsx           # client modals (role / grant / notify / delete)
    StudentDetail.module.css
  AdminBanner.tsx                # banner shown on /dashboard for admins
  AdminBanner.module.css

__tests__/
  unit/
    admin-guard.test.ts
    admin-metrics.test.ts
    admin-plan-prices.test.ts
  actions/
    admin-alumnos-actions.test.ts
  components/
    admin-students-table.test.tsx
    admin-kpi-card.test.tsx
    admin-banner.test.tsx
```

**Existing files modified:**

- `app/dashboard/page.tsx` — pass `role` to `DashboardClient` so it can render `AdminBanner`.
- `components/DashboardClient.tsx` — render `<AdminBanner />` when `role === 'admin'`.
- `package.json` — add `recharts` dependency.
- `vitest.config.ts` — extend `coverage.include` with `utils/admin/**` and `app/admin/**/actions.ts`.

**Files NOT changed:**

- `/courses/*` admin-edit routes — kept as-is. The panel links to them.
- Database schema / RLS — no migrations.
- `utils/supabase/admin.ts` — already exposes `createSupabaseAdmin()`; reused.

---

## Phase 1 — Foundation: guard, layout, sidebar

### Task 1.1: `requireAdmin()` guard helper

**Files:**
- Create: `utils/admin/guard.ts`
- Create: `__tests__/unit/admin-guard.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/admin-guard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn() }))

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

function makeClient(user: { id: string } | null) {
  return {
    auth: { getUser: mockGetUser.mockResolvedValue({ data: { user } }) },
    from: mockFrom,
  }
}

describe('requireAdmin', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValue(makeClient({ id: 'u1' }) as never)
  })

  it('returns the user when role is admin', async () => {
    mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
    const { requireAdmin } = await import('@/utils/admin/guard')
    const u = await requireAdmin()
    expect(u.id).toBe('u1')
  })

  it('throws AdminGuardError when role is member', async () => {
    mockSingle.mockResolvedValueOnce({ data: { role: 'member' }, error: null })
    const { requireAdmin, AdminGuardError } = await import('@/utils/admin/guard')
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminGuardError)
  })

  it('throws AdminGuardError when role is premium', async () => {
    mockSingle.mockResolvedValueOnce({ data: { role: 'premium' }, error: null })
    const { requireAdmin, AdminGuardError } = await import('@/utils/admin/guard')
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminGuardError)
  })

  it('throws AdminGuardError when no user is logged in', async () => {
    const { createClient } = await import('@/utils/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce(makeClient(null) as never)
    const { requireAdmin, AdminGuardError } = await import('@/utils/admin/guard')
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminGuardError)
  })

  it('throws AdminGuardError when profile lookup errors', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'db' } })
    const { requireAdmin, AdminGuardError } = await import('@/utils/admin/guard')
    await expect(requireAdmin()).rejects.toBeInstanceOf(AdminGuardError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/admin-guard.test.ts`
Expected: all tests FAIL with "Cannot find module '@/utils/admin/guard'".

- [ ] **Step 3: Implement `requireAdmin()`**

Create `utils/admin/guard.ts`:

```typescript
import { createClient } from '@/utils/supabase/server'

export class AdminGuardError extends Error {
  constructor(public reason: 'unauthenticated' | 'forbidden' | 'lookup_failed') {
    super(`AdminGuard: ${reason}`)
    this.name = 'AdminGuardError'
  }
}

export type AdminUser = { id: string }

export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AdminGuardError('unauthenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !data) throw new AdminGuardError('lookup_failed')
  if (data.role !== 'admin') throw new AdminGuardError('forbidden')

  return { id: user.id }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/admin-guard.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/admin/guard.ts __tests__/unit/admin-guard.test.ts
git commit -m "feat(admin): add requireAdmin guard"
```

### Task 1.2: Admin layout with role guard + redirect

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/layout.module.css`

- [ ] **Step 1: Implement `app/admin/layout.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { requireAdmin, AdminGuardError } from '@/utils/admin/guard'
import { createClient } from '@/utils/supabase/server'
import AdminSidebar from '@/components/admin/AdminSidebar'
import styles from './layout.module.css'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AdminGuardError) {
      if (e.reason === 'unauthenticated') redirect('/login')
      redirect('/dashboard')
    }
    throw e
  }

  const supabase = await createClient()
  const { count } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <div className={styles.shell}>
      <AdminSidebar pendingSubmissions={count ?? 0} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/admin/layout.module.css`**

```css
.shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
  background: var(--background);
  color: var(--text-main);
}

.main {
  min-width: 0;
  padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1rem, 4vw, 3rem);
  overflow-x: hidden;
}

@media (max-width: 768px) {
  .shell { grid-template-columns: 1fr; }
  .main { padding: 1rem; }
}
```

- [ ] **Step 3: Commit (will not yet build — sidebar component pending)**

```bash
git add app/admin/layout.tsx app/admin/layout.module.css
git commit -m "feat(admin): scaffold admin layout with role guard"
```

### Task 1.3: `AdminSidebar` component

**Files:**
- Create: `components/admin/AdminSidebar.tsx`
- Create: `components/admin/AdminSidebar.module.css`

- [ ] **Step 1: Implement `AdminSidebar.tsx`**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Inbox,
  GraduationCap,
  MessagesSquare,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react'
import styles from './AdminSidebar.module.css'

type Item = { href: string; label: string; Icon: typeof Users; badge?: number }

export default function AdminSidebar({ pendingSubmissions }: { pendingSubmissions: number }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const items: Item[] = [
    { href: '/admin', label: 'Inicio', Icon: LayoutDashboard },
    { href: '/admin/alumnos', label: 'Alumnos', Icon: Users },
    { href: '/admin/estadisticas', label: 'Estadísticas', Icon: BarChart3 },
    { href: '/admin/entregas', label: 'Entregas', Icon: Inbox, badge: pendingSubmissions },
    { href: '/admin/cursos', label: 'Cursos', Icon: GraduationCap },
    { href: '/admin/comunidad', label: 'Comunidad', Icon: MessagesSquare },
  ]

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href)

  return (
    <>
      <button
        className={styles.burger}
        aria-label="Abrir menú admin"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>

      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.brand}>
          <span className={styles.brandTitle}>Luis &amp; Sara</span>
          <span className={styles.brandLabel}>Admin</span>
          <button
            className={styles.close}
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className={styles.nav}>
          {items.map(({ href, label, Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.item} ${isActive(href) ? styles.active : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={16} strokeWidth={2} aria-hidden />
              <span>{label}</span>
              {badge && badge > 0 ? (
                <span className={styles.badge}>{badge}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className={styles.footer}>
          <Link href="/dashboard" className={styles.backLink}>
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            Volver al sitio
          </Link>
        </div>
      </aside>

      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 2: Create `AdminSidebar.module.css`**

```css
.sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgba(var(--primary-rgb), 0.04);
  border-right: 1px solid rgba(var(--primary-rgb), 0.12);
  padding: 1.25rem 0.85rem;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem 1.25rem;
  border-bottom: 1px solid rgba(var(--primary-rgb), 0.1);
  margin-bottom: 0.75rem;
}

.brandTitle {
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-main);
}

.brandLabel {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(var(--primary-rgb), 1);
}

.close { display: none; margin-left: auto; background: transparent; border: 0; color: inherit; cursor: pointer; }

.nav { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; }

.item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.65rem;
  border-radius: 6px;
  color: rgba(var(--text-rgb, 30, 30, 30), 0.75);
  text-decoration: none;
  font-size: 0.92rem;
  position: relative;
  transition: background-color 120ms ease;
}

.item:hover { background: rgba(var(--primary-rgb), 0.06); color: var(--text-main); }

.active {
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--text-main);
}

.active::before {
  content: '';
  position: absolute;
  left: -0.85rem;
  top: 0.4rem;
  bottom: 0.4rem;
  width: 2px;
  background: rgba(var(--primary-rgb), 1);
  border-radius: 2px;
}

.badge {
  margin-left: auto;
  background: rgba(var(--primary-rgb), 0.18);
  color: rgba(var(--primary-rgb), 1);
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
  min-width: 20px;
  text-align: center;
}

.footer { padding-top: 0.85rem; border-top: 1px solid rgba(var(--primary-rgb), 0.1); }

.backLink {
  display: inline-flex; align-items: center; gap: 0.4rem;
  color: rgba(var(--text-rgb, 30, 30, 30), 0.65);
  text-decoration: none; font-size: 0.85rem;
}

.backLink:hover { color: var(--text-main); }

.burger {
  display: none;
  position: fixed;
  top: 12px; left: 12px;
  z-index: 30;
  background: var(--background);
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  color: var(--text-main);
}

.backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 28;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed; inset: 0 auto 0 0;
    width: 260px; z-index: 29;
    transform: translateX(-100%);
    transition: transform 200ms ease;
  }
  .sidebar.open { transform: translateX(0); }
  .burger { display: inline-flex; }
  .close { display: inline-flex; }
}

@media (min-width: 769px) {
  .backdrop { display: none; }
}
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/AdminSidebar.tsx components/admin/AdminSidebar.module.css
git commit -m "feat(admin): add admin sidebar with active-route highlighting"
```

### Task 1.4: Smoke check that the admin shell loads

- [ ] **Step 1: Add a placeholder `app/admin/page.tsx`**

```typescript
export default function AdminHome() {
  return <h1>Admin · Inicio</h1>
}
```

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build`
Expected: build completes without errors. The route `/admin` appears in the build output as a dynamic route.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`
- As a non-admin user, visit `http://localhost:3000/admin` — should redirect to `/dashboard`.
- As an admin user, visit `/admin` — should render the sidebar + heading. Click each nav item — Inicio works (others 404, that's fine for now).
- On mobile width (<768px), the burger button should appear and the drawer should slide in.

- [ ] **Step 4: Commit placeholder**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): add placeholder admin home page"
```

---

## Phase 2 — Overview page (KPIs + lists + quick actions)

### Task 2.1: Plan price constants (used by MRR)

**Files:**
- Create: `utils/admin/plan-prices.ts`
- Create: `__tests__/unit/admin-plan-prices.test.ts`

The `STRIPE_CONFIG` only has price IDs, not numeric € amounts. We need numeric amounts to compute MRR. We add a sibling constants file holding the canonical € price for each `plan_type`. **The admin must fill the actual numbers** before this is meaningful — the file ships with placeholder zeros and a clearly-marked TODO so the price audit is explicit.

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/admin-plan-prices.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PLAN_PRICES_EUR, monthlyEquivalent } from '@/utils/admin/plan-prices'

describe('plan prices', () => {
  it('exposes a numeric € price for each plan_type', () => {
    expect(typeof PLAN_PRICES_EUR['1month']).toBe('number')
    expect(typeof PLAN_PRICES_EUR['6months']).toBe('number')
    expect(typeof PLAN_PRICES_EUR['1year']).toBe('number')
  })

  it('monthlyEquivalent("1month", 19) === 19', () => {
    expect(monthlyEquivalent('1month', 19)).toBe(19)
  })

  it('monthlyEquivalent("6months", 90) === 15', () => {
    expect(monthlyEquivalent('6months', 90)).toBe(15)
  })

  it('monthlyEquivalent("1year", 180) === 15', () => {
    expect(monthlyEquivalent('1year', 180)).toBe(15)
  })

  it('returns 0 for unknown plan_type', () => {
    // @ts-expect-error testing unknown plan
    expect(monthlyEquivalent('xx', 100)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/admin-plan-prices.test.ts`
Expected: FAIL "Cannot find module '@/utils/admin/plan-prices'".

- [ ] **Step 3: Implement**

Create `utils/admin/plan-prices.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/admin-plan-prices.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/admin/plan-prices.ts __tests__/unit/admin-plan-prices.test.ts
git commit -m "feat(admin): add plan price constants and monthly-equivalent helper"
```

### Task 2.2: `metrics.ts` — pure calculators

**Files:**
- Create: `utils/admin/metrics.ts`
- Create: `__tests__/unit/admin-metrics.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/admin-metrics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  computeMRR,
  groupByMonth,
  pctChange,
  formatRelative,
  centsToEur,
} from '@/utils/admin/metrics'
import { PLAN_PRICES_EUR } from '@/utils/admin/plan-prices'

describe('computeMRR', () => {
  it('sums monthly-equivalent for active subs', () => {
    const subs = [
      { plan_type: '1month' as const },
      { plan_type: '6months' as const },
      { plan_type: '1year' as const },
    ]
    PLAN_PRICES_EUR['1month'] = 19
    PLAN_PRICES_EUR['6months'] = 90
    PLAN_PRICES_EUR['1year'] = 180
    expect(computeMRR(subs)).toBeCloseTo(19 + 15 + 15, 2)
  })

  it('returns 0 with no subs', () => {
    expect(computeMRR([])).toBe(0)
  })
})

describe('groupByMonth', () => {
  it('groups dates into ISO month keys with sums', () => {
    const rows = [
      { date: '2026-01-15', amount: 100 },
      { date: '2026-01-28', amount: 50 },
      { date: '2026-02-03', amount: 200 },
    ]
    const out = groupByMonth(rows, r => r.date, r => r.amount)
    expect(out).toEqual([
      { month: '2026-01', value: 150 },
      { month: '2026-02', value: 200 },
    ])
  })

  it('returns empty array for empty input', () => {
    expect(groupByMonth([], () => '2026-01-01', () => 0)).toEqual([])
  })
})

describe('pctChange', () => {
  it('+50% from 100 to 150', () => {
    expect(pctChange(100, 150)).toBe(50)
  })
  it('-25% from 200 to 150', () => {
    expect(pctChange(200, 150)).toBe(-25)
  })
  it('returns null when previous is 0', () => {
    expect(pctChange(0, 100)).toBeNull()
  })
})

describe('centsToEur', () => {
  it('1234 → 12.34', () => {
    expect(centsToEur(1234)).toBe(12.34)
  })
  it('null → 0', () => {
    expect(centsToEur(null)).toBe(0)
  })
})

describe('formatRelative', () => {
  it('uses "hace Xh" for hours', () => {
    const d = new Date(Date.now() - 3 * 3600_000)
    expect(formatRelative(d.toISOString())).toMatch(/hace 3h/)
  })
  it('uses "hace Xd" for days', () => {
    const d = new Date(Date.now() - 5 * 86_400_000)
    expect(formatRelative(d.toISOString())).toMatch(/hace 5d/)
  })
  it('uses "hace Xmin" for minutes', () => {
    const d = new Date(Date.now() - 7 * 60_000)
    expect(formatRelative(d.toISOString())).toMatch(/hace 7min/)
  })
})
```

- [ ] **Step 2: Run tests — should fail with module not found**

Run: `npx vitest run __tests__/unit/admin-metrics.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `utils/admin/metrics.ts`**

```typescript
import {
  PLAN_PRICES_EUR,
  monthlyEquivalent,
  type PlanType,
} from '@/utils/admin/plan-prices'

export function computeMRR(subs: { plan_type: PlanType | null }[]): number {
  return subs.reduce((acc, s) => {
    if (!s.plan_type) return acc
    const total = PLAN_PRICES_EUR[s.plan_type] ?? 0
    return acc + monthlyEquivalent(s.plan_type, total)
  }, 0)
}

export function groupByMonth<T>(
  rows: T[],
  getDate: (r: T) => string,
  getValue: (r: T) => number,
): { month: string; value: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const d = new Date(getDate(r))
    if (Number.isNaN(d.valueOf())) continue
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + getValue(r))
  }
  return [...map.entries()]
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export function pctChange(prev: number, curr: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

export function centsToEur(cents: number | null | undefined): number {
  if (cents == null) return 0
  return Math.round(cents) / 100
}

export function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).valueOf()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `hace ${Math.max(1, min)}min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr}h`
  const d = Math.floor(hr / 24)
  if (d < 30) return `hace ${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `hace ${mo}m`
  return `hace ${Math.floor(mo / 12)}a`
}
```

- [ ] **Step 4: Run tests — all PASS**

Run: `npx vitest run __tests__/unit/admin-metrics.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/admin/metrics.ts __tests__/unit/admin-metrics.test.ts
git commit -m "feat(admin): add pure metric calculators (MRR, grouping, pct change)"
```

### Task 2.3: `queries.ts` — overview KPI fetchers

**Files:**
- Create: `utils/admin/queries.ts`

This module wraps the service-role client and exposes named fetchers used by `/admin/page.tsx`. Each fetcher calls `requireAdmin()` first as a defense-in-depth check; the result of `requireAdmin()` is unused but the throw protects against accidental import outside admin contexts.

- [ ] **Step 1: Implement `utils/admin/queries.ts` (overview slice)**

```typescript
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { requireAdmin } from '@/utils/admin/guard'

export type OverviewKpis = {
  totalStudents: number
  newThisWeek: number
  newToday: number
  activeSubs: number
  mrrEur: number
  monthRevenueEur: number
  prevMonthRevenueEur: number
  publishedCourses: number
  totalLessons: number
  pendingSubmissions: number
  oldestPendingDays: number | null
}

const WEEK_MS = 7 * 86_400_000
const DAY_MS = 86_400_000

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export async function getOverviewKpis(): Promise<OverviewKpis> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - WEEK_MS).toISOString()
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString()
  const monthStart = startOfMonthUTC(now).toISOString()
  const prevMonthStart = startOfMonthUTC(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  ).toISOString()

  const [
    studentsCount,
    newWeekCount,
    newTodayCount,
    activeSubsRows,
    monthPurchases,
    prevMonthPurchases,
    coursesCount,
    lessonsCount,
    pendingSubs,
    oldestPending,
  ] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('profiles').select('id', { count: 'exact', head: true }).gte('updated_at', weekAgo),
    sb.from('profiles').select('id', { count: 'exact', head: true }).gte('updated_at', dayAgo),
    sb.from('subscriptions')
      .select('plan_type')
      .in('status', ['active', 'trialing']),
    sb.from('course_purchases')
      .select('amount_paid')
      .gte('created_at', monthStart),
    sb.from('course_purchases')
      .select('amount_paid')
      .gte('created_at', prevMonthStart)
      .lt('created_at', monthStart),
    sb.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true),
    sb.from('lessons').select('id', { count: 'exact', head: true }),
    sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('submissions')
      .select('created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const { computeMRR, centsToEur } = await import('@/utils/admin/metrics')

  const monthRev = (monthPurchases.data ?? [])
    .reduce((s: number, r: { amount_paid: number | null }) => s + centsToEur(r.amount_paid), 0)
  const prevMonthRev = (prevMonthPurchases.data ?? [])
    .reduce((s: number, r: { amount_paid: number | null }) => s + centsToEur(r.amount_paid), 0)

  const oldestDays = oldestPending.data?.created_at
    ? Math.floor((Date.now() - new Date(oldestPending.data.created_at).valueOf()) / DAY_MS)
    : null

  return {
    totalStudents: studentsCount.count ?? 0,
    newThisWeek: newWeekCount.count ?? 0,
    newToday: newTodayCount.count ?? 0,
    activeSubs: (activeSubsRows.data ?? []).length,
    mrrEur: computeMRR((activeSubsRows.data ?? []) as { plan_type: '1month' | '6months' | '1year' | null }[]),
    monthRevenueEur: monthRev,
    prevMonthRevenueEur: prevMonthRev,
    publishedCourses: coursesCount.count ?? 0,
    totalLessons: lessonsCount.count ?? 0,
    pendingSubmissions: pendingSubs.count ?? 0,
    oldestPendingDays: oldestDays,
  }
}
```

> **Note on `profiles.updated_at`:** the schema doesn't have `created_at` on `profiles`, so we use `updated_at` as a proxy for "created" (the trigger sets it on insert and inserts only happen via signup). If `created_at` is added later, swap it here.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `utils/admin/queries.ts`.

- [ ] **Step 3: Commit**

```bash
git add utils/admin/queries.ts
git commit -m "feat(admin): add overview KPI fetcher"
```

### Task 2.4: `AdminKpiCard` presentational component

**Files:**
- Create: `components/admin/AdminKpiCard.tsx`
- Create: `components/admin/AdminKpiCard.module.css`
- Create: `__tests__/components/admin-kpi-card.test.tsx`

- [ ] **Step 1: Write component test**

Create `__tests__/components/admin-kpi-card.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Users } from 'lucide-react'
import AdminKpiCard from '@/components/admin/AdminKpiCard'

describe('AdminKpiCard', () => {
  it('renders label, value and sub', () => {
    render(<AdminKpiCard label="Alumnos" value="42" sub="+3 esta semana" Icon={Users} />)
    expect(screen.getByText('Alumnos')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('+3 esta semana')).toBeInTheDocument()
  })

  it('does not render sub when not provided', () => {
    const { container } = render(<AdminKpiCard label="X" value="0" Icon={Users} />)
    expect(container.querySelector('[data-slot="sub"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — fails**

Run: `npx vitest run __tests__/components/admin-kpi-card.test.tsx`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement `AdminKpiCard.tsx`**

```typescript
import type { LucideIcon } from 'lucide-react'
import styles from './AdminKpiCard.module.css'

type Props = {
  label: string
  value: string
  sub?: string
  Icon: LucideIcon
  trend?: 'up' | 'down' | null
}

export default function AdminKpiCard({ label, value, sub, Icon, trend }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.icon} aria-hidden>
          <Icon size={14} strokeWidth={2.2} />
        </span>
      </div>
      <div className={styles.value}>{value}</div>
      {sub ? (
        <p data-slot="sub" className={`${styles.sub} ${trend ? styles[trend] : ''}`}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Implement `AdminKpiCard.module.css`**

```css
.card {
  background: rgba(var(--primary-rgb), 0.03);
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  border-radius: 10px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.header { display: flex; align-items: center; justify-content: space-between; }

.label {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(var(--text-rgb, 30, 30, 30), 0.65);
}

.icon {
  color: rgba(var(--primary-rgb), 1);
  display: inline-flex;
}

.value {
  font-size: clamp(1.5rem, 2.4vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: rgba(var(--primary-rgb), 1);
}

.sub {
  font-size: 0.78rem;
  color: rgba(var(--text-rgb, 30, 30, 30), 0.7);
  margin: 0;
}

.up { color: rgba(40, 140, 70, 0.95); }
.down { color: rgba(180, 60, 60, 0.95); }
```

- [ ] **Step 5: Run test — passes**

Run: `npx vitest run __tests__/components/admin-kpi-card.test.tsx`
Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add components/admin/AdminKpiCard.tsx components/admin/AdminKpiCard.module.css __tests__/components/admin-kpi-card.test.tsx
git commit -m "feat(admin): add AdminKpiCard component"
```

### Task 2.5: Overview page — Block A (hero + KPIs)

**Files:**
- Modify: `app/admin/page.tsx`
- Create: `app/admin/page.module.css`

- [ ] **Step 1: Replace placeholder `app/admin/page.tsx`**

```typescript
import {
  Users, UserPlus, Sparkles, GraduationCap, BookOpen, Inbox,
} from 'lucide-react'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import { getOverviewKpis } from '@/utils/admin/queries'
import { pctChange } from '@/utils/admin/metrics'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const k = await getOverviewKpis()
  const change = pctChange(k.prevMonthRevenueEur, k.monthRevenueEur)
  const arrow = change === null ? '' : change > 0 ? '↑' : change < 0 ? '↓' : ''
  const trend: 'up' | 'down' | null =
    change === null ? null : change > 0 ? 'up' : change < 0 ? 'down' : null

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>PANEL · ADMIN</span>
        <h1 className={styles.title}>Centro de control</h1>
        <p className={styles.sub}>
          Estado actual del negocio, alumnos y entregas.
        </p>
      </header>

      <section className={styles.kpiGrid} aria-label="Métricas principales">
        <AdminKpiCard
          Icon={Users}
          label="Alumnos totales"
          value={String(k.totalStudents)}
          sub={`+${k.newThisWeek} esta semana`}
        />
        <AdminKpiCard
          Icon={Sparkles}
          label="Suscripciones activas"
          value={String(k.activeSubs)}
          sub={`MRR ~ €${k.mrrEur.toFixed(0)}/mes`}
        />
        <AdminKpiCard
          Icon={Sparkles}
          label="Ingresos del mes"
          value={`€${k.monthRevenueEur.toFixed(0)}`}
          sub={
            change === null
              ? `vs €${k.prevMonthRevenueEur.toFixed(0)} mes ant.`
              : `vs €${k.prevMonthRevenueEur.toFixed(0)} ${arrow}${Math.abs(change)}%`
          }
          trend={trend}
        />
        <AdminKpiCard
          Icon={GraduationCap}
          label="Cursos publicados"
          value={String(k.publishedCourses)}
          sub={`${k.totalLessons} lecciones`}
        />
        <AdminKpiCard
          Icon={Inbox}
          label="Entregas pendientes"
          value={String(k.pendingSubmissions)}
          sub={
            k.oldestPendingDays != null
              ? `Más antigua: hace ${k.oldestPendingDays}d`
              : 'Sin pendientes'
          }
        />
        <AdminKpiCard
          Icon={UserPlus}
          label="Nuevos esta semana"
          value={String(k.newThisWeek)}
          sub={`+${k.newToday} hoy`}
        />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/admin/page.module.css`**

```css
.container { display: flex; flex-direction: column; gap: 2rem; }

.hero { display: flex; flex-direction: column; gap: 0.4rem; }

.eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(var(--primary-rgb), 1);
}

.title {
  font-size: clamp(1.75rem, 3vw, 2.4rem);
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
}

.sub {
  color: rgba(var(--text-rgb, 30, 30, 30), 0.7);
  margin: 0;
  max-width: 60ch;
}

.kpiGrid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

@media (max-width: 1200px) { .kpiGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 768px) { .kpiGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .kpiGrid { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` and open `/admin` as admin. Confirm 6 KPI cards render with values from your Supabase. Numbers may be 0 — that's fine.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx app/admin/page.module.css
git commit -m "feat(admin): render 6 KPI cards on overview"
```

### Task 2.6: Overview — Block C lists (latest students / purchases / active courses)

**Files:**
- Modify: `utils/admin/queries.ts`
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/page.module.css`

- [ ] **Step 1: Add overview list fetchers to `utils/admin/queries.ts`**

Append to the file:

```typescript
export type LatestStudent = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string  // we use updated_at as proxy
}

export type RecentPayment =
  | { kind: 'purchase'; userId: string; userName: string | null; courseTitle: string; amountEur: number; date: string }
  | { kind: 'subscription'; userId: string; userName: string | null; planType: string | null; date: string }

export type ActiveCourse = {
  id: string
  title: string
  image_url: string | null
  completedCount: number
}

export async function getLatestStudents(limit = 5): Promise<LatestStudent[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { data } = await sb
    .from('profiles')
    .select('id, full_name, email, avatar_url, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: r.full_name as string | null,
    email: r.email as string | null,
    avatar_url: r.avatar_url as string | null,
    created_at: r.updated_at as string,
  }))
}

export async function getRecentPayments(limit = 5): Promise<RecentPayment[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { centsToEur } = await import('@/utils/admin/metrics')

  const [purchases, subs] = await Promise.all([
    sb.from('course_purchases')
      .select('user_id, amount_paid, created_at, courses(title), profiles!inner(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    sb.from('subscriptions')
      .select('user_id, plan_type, created_at, profiles!inner(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  type PurchaseRow = {
    user_id: string; amount_paid: number | null; created_at: string;
    courses: { title: string } | { title: string }[] | null;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  }
  type SubRow = {
    user_id: string; plan_type: string | null; created_at: string;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  }

  const pickFirst = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v

  const merged: RecentPayment[] = [
    ...(purchases.data ?? []).map((r: PurchaseRow): RecentPayment => ({
      kind: 'purchase',
      userId: r.user_id,
      userName: pickFirst(r.profiles)?.full_name ?? null,
      courseTitle: pickFirst(r.courses)?.title ?? '—',
      amountEur: centsToEur(r.amount_paid),
      date: r.created_at,
    })),
    ...(subs.data ?? []).map((r: SubRow): RecentPayment => ({
      kind: 'subscription',
      userId: r.user_id,
      userName: pickFirst(r.profiles)?.full_name ?? null,
      planType: r.plan_type,
      date: r.created_at,
    })),
  ]

  return merged
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}

export async function getActiveCourses(limit = 5): Promise<ActiveCourse[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()

  const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString()

  // 1. recent completed lesson_progress with course_id via lessons join
  const { data: progress } = await sb
    .from('lesson_progress')
    .select('lessons!inner(course_id)')
    .eq('is_completed', true)
    .gte('updated_at', sinceIso)

  type Row = { lessons: { course_id: string } | { course_id: string }[] | null }
  const counts = new Map<string, number>()
  for (const r of (progress ?? []) as Row[]) {
    const lessons = Array.isArray(r.lessons) ? r.lessons[0] : r.lessons
    const cid = lessons?.course_id
    if (!cid) continue
    counts.set(cid, (counts.get(cid) ?? 0) + 1)
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  if (top.length === 0) return []

  const { data: courses } = await sb
    .from('courses')
    .select('id, title, image_url')
    .in('id', top.map(([id]) => id))

  const byId = new Map((courses ?? []).map(c => [c.id as string, c]))
  return top.map(([id, count]) => ({
    id,
    title: (byId.get(id)?.title as string) ?? '—',
    image_url: (byId.get(id)?.image_url as string | null) ?? null,
    completedCount: count,
  }))
}
```

- [ ] **Step 2: Update `app/admin/page.tsx` to render Block C**

Replace the file:

```typescript
import {
  Users, UserPlus, Sparkles, GraduationCap, BookOpen, Inbox,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import {
  getOverviewKpis, getLatestStudents, getRecentPayments, getActiveCourses,
} from '@/utils/admin/queries'
import { pctChange, formatRelative } from '@/utils/admin/metrics'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const [k, latestStudents, recentPayments, activeCourses] = await Promise.all([
    getOverviewKpis(),
    getLatestStudents(),
    getRecentPayments(),
    getActiveCourses(),
  ])

  const change = pctChange(k.prevMonthRevenueEur, k.monthRevenueEur)
  const arrow = change === null ? '' : change > 0 ? '↑' : change < 0 ? '↓' : ''
  const trend: 'up' | 'down' | null =
    change === null ? null : change > 0 ? 'up' : change < 0 ? 'down' : null

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>PANEL · ADMIN</span>
        <h1 className={styles.title}>Centro de control</h1>
        <p className={styles.sub}>Estado actual del negocio, alumnos y entregas.</p>
      </header>

      <section className={styles.kpiGrid} aria-label="Métricas principales">
        <AdminKpiCard Icon={Users} label="Alumnos totales" value={String(k.totalStudents)} sub={`+${k.newThisWeek} esta semana`} />
        <AdminKpiCard Icon={Sparkles} label="Suscripciones activas" value={String(k.activeSubs)} sub={`MRR ~ €${k.mrrEur.toFixed(0)}/mes`} />
        <AdminKpiCard
          Icon={Sparkles}
          label="Ingresos del mes"
          value={`€${k.monthRevenueEur.toFixed(0)}`}
          sub={
            change === null
              ? `vs €${k.prevMonthRevenueEur.toFixed(0)} mes ant.`
              : `vs €${k.prevMonthRevenueEur.toFixed(0)} ${arrow}${Math.abs(change)}%`
          }
          trend={trend}
        />
        <AdminKpiCard Icon={GraduationCap} label="Cursos publicados" value={String(k.publishedCourses)} sub={`${k.totalLessons} lecciones`} />
        <AdminKpiCard
          Icon={Inbox}
          label="Entregas pendientes"
          value={String(k.pendingSubmissions)}
          sub={k.oldestPendingDays != null ? `Más antigua: hace ${k.oldestPendingDays}d` : 'Sin pendientes'}
        />
        <AdminKpiCard Icon={UserPlus} label="Nuevos esta semana" value={String(k.newThisWeek)} sub={`+${k.newToday} hoy`} />
      </section>

      <section className={styles.lists}>
        {/* Latest students */}
        <div className={styles.listCard}>
          <header className={styles.listHeader}>
            <h2>Últimos alumnos</h2>
            <Link href="/admin/alumnos" className={styles.listLink}>Ver todos →</Link>
          </header>
          <ul className={styles.listBody}>
            {latestStudents.length === 0 && <li className={styles.empty}>Sin alumnos.</li>}
            {latestStudents.map(s => (
              <li key={s.id} className={styles.listRow}>
                <Link href={`/admin/alumnos/${s.id}`} className={styles.listRowLink}>
                  {s.avatar_url ? (
                    <Image src={s.avatar_url} alt="" width={28} height={28} className={styles.avatar} />
                  ) : (
                    <span className={styles.avatarFallback} aria-hidden />
                  )}
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{s.full_name ?? 'Sin nombre'}</span>
                    <span className={styles.rowMeta}>{s.email}</span>
                  </span>
                  <span className={styles.rowAside}>{formatRelative(s.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent payments */}
        <div className={styles.listCard}>
          <header className={styles.listHeader}>
            <h2>Compras y suscripciones</h2>
          </header>
          <ul className={styles.listBody}>
            {recentPayments.length === 0 && <li className={styles.empty}>Sin movimientos.</li>}
            {recentPayments.map((p, i) => (
              <li key={`${p.kind}-${i}`} className={styles.listRow}>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>{p.userName ?? 'Anónimo'}</span>
                  <span className={styles.rowMeta}>
                    {p.kind === 'purchase'
                      ? `compró ${p.courseTitle}`
                      : `se suscribió (${p.planType ?? '—'})`}
                  </span>
                </span>
                <span className={styles.rowAside}>
                  {p.kind === 'purchase' ? `€${p.amountEur.toFixed(0)} · ` : ''}
                  {formatRelative(p.date)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Active courses */}
        <div className={styles.listCard}>
          <header className={styles.listHeader}>
            <h2>Cursos más activos</h2>
            <Link href="/admin/cursos" className={styles.listLink}>Ver todos →</Link>
          </header>
          <ul className={styles.listBody}>
            {activeCourses.length === 0 && <li className={styles.empty}>Sin actividad reciente.</li>}
            {activeCourses.map(c => (
              <li key={c.id} className={styles.listRow}>
                <Link href={`/courses/${c.id}`} className={styles.listRowLink}>
                  {c.image_url ? (
                    <Image src={c.image_url} alt="" width={32} height={32} className={styles.thumb} />
                  ) : (
                    <span className={styles.thumbFallback} aria-hidden><BookOpen size={14} /></span>
                  )}
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{c.title}</span>
                    <span className={styles.rowMeta}>{c.completedCount} lecciones completadas (30d)</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Append list styles to `app/admin/page.module.css`**

```css
.lists {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 1100px) { .lists { grid-template-columns: 1fr; } }

.listCard {
  background: rgba(var(--primary-rgb), 0.03);
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.listHeader { display: flex; align-items: baseline; justify-content: space-between; }
.listHeader h2 { font-size: 0.95rem; font-weight: 600; margin: 0; }
.listLink { font-size: 0.8rem; color: rgba(var(--primary-rgb), 1); text-decoration: none; }
.listLink:hover { text-decoration: underline; }

.listBody { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }

.listRow { border-radius: 6px; }
.listRow:hover { background: rgba(var(--primary-rgb), 0.05); }

.listRowLink {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.5rem 0.4rem;
  text-decoration: none; color: inherit;
}

.avatar, .avatarFallback, .thumb, .thumbFallback {
  width: 28px; height: 28px; border-radius: 50%;
  object-fit: cover; flex-shrink: 0;
  background: rgba(var(--primary-rgb), 0.12);
}
.thumb, .thumbFallback { border-radius: 6px; }
.thumbFallback { display: inline-flex; align-items: center; justify-content: center; color: rgba(var(--primary-rgb), 1); }

.rowMain { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.rowName { font-size: 0.88rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rowMeta { font-size: 0.76rem; color: rgba(var(--text-rgb, 30, 30, 30), 0.65); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.rowAside { font-size: 0.75rem; color: rgba(var(--text-rgb, 30, 30, 30), 0.6); white-space: nowrap; }

.empty { padding: 0.6rem; font-size: 0.85rem; color: rgba(var(--text-rgb, 30, 30, 30), 0.55); }
```

- [ ] **Step 4: Smoke test**

Run: `npm run dev`. Visit `/admin`. Confirm three cards appear with data (or empty states).

- [ ] **Step 5: Commit**

```bash
git add utils/admin/queries.ts app/admin/page.tsx app/admin/page.module.css
git commit -m "feat(admin): add overview lists (students/payments/courses)"
```

### Task 2.7: Overview — Block D quick actions

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/page.module.css`

- [ ] **Step 1: Add quick actions section to `app/admin/page.tsx`**

Add this section before the closing `</div>` of the container:

```tsx
<section className={styles.actions} aria-label="Accesos rápidos">
  <Link href="/courses/create" className={styles.actionBtn}>
    <span className={styles.actionPlus}>+</span> Crear curso
  </Link>
  <Link href="/admin/cursos" className={styles.actionBtn}>
    <span className={styles.actionPlus}>+</span> Crear lección
  </Link>
  <Link href="/admin/alumnos" className={styles.actionBtn}>
    <ArrowRight size={14} aria-hidden /> Ver alumnos
  </Link>
  <Link href="/admin/entregas" className={styles.actionBtn}>
    <ArrowRight size={14} aria-hidden /> Entregas pendientes
    {k.pendingSubmissions > 0 ? <span className={styles.actionBadge}>{k.pendingSubmissions}</span> : null}
  </Link>
</section>
```

> "Crear lección" links to `/admin/cursos` (where the user picks the course); the dedicated add-lesson route exists per course.

- [ ] **Step 2: Append styles**

```css
.actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (max-width: 800px) { .actions { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .actions { grid-template-columns: 1fr; } }

.actionBtn {
  display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.85rem 1rem;
  background: rgba(var(--primary-rgb), 0.08);
  border: 1px solid rgba(var(--primary-rgb), 0.18);
  border-radius: 8px;
  color: var(--text-main);
  text-decoration: none;
  font-size: 0.9rem;
  transition: background-color 120ms ease;
}

.actionBtn:hover { background: rgba(var(--primary-rgb), 0.14); }
.actionPlus { color: rgba(var(--primary-rgb), 1); font-weight: 700; }
.actionBadge {
  margin-left: auto;
  background: rgba(var(--primary-rgb), 1);
  color: white;
  font-size: 0.72rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx app/admin/page.module.css
git commit -m "feat(admin): add quick-action buttons to overview"
```

---

## Phase 3 — Revenue trend chart (Recharts)

### Task 3.1: Install Recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

Run: `npm install recharts@^2.12.0`
Expected: dependency added; lockfile updated.

- [ ] **Step 2: Verify install**

Run: `npx tsc --noEmit`
Expected: no TS errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts dependency"
```

### Task 3.2: Revenue timeseries fetcher

**Files:**
- Modify: `utils/admin/queries.ts`

- [ ] **Step 1: Append `getRevenueTimeseries` to `utils/admin/queries.ts`**

```typescript
export type RevenueDay = {
  date: string         // YYYY-MM-DD (UTC)
  purchases: number    // €
  subscriptions: number // €  (one-shot recognition on `created_at`, simple v1)
}

export async function getRevenueTimeseries(rangeDays: 30 | 90): Promise<RevenueDay[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { centsToEur } = await import('@/utils/admin/metrics')
  const { PLAN_PRICES_EUR } = await import('@/utils/admin/plan-prices')

  const since = new Date(Date.now() - rangeDays * 86_400_000)
  since.setUTCHours(0, 0, 0, 0)
  const sinceIso = since.toISOString()

  const [purchases, subs] = await Promise.all([
    sb.from('course_purchases').select('amount_paid, created_at').gte('created_at', sinceIso),
    sb.from('subscriptions').select('plan_type, created_at').gte('created_at', sinceIso),
  ])

  const buckets = new Map<string, RevenueDay>()
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(since)
    d.setUTCDate(d.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    buckets.set(key, { date: key, purchases: 0, subscriptions: 0 })
  }

  for (const r of purchases.data ?? []) {
    const key = (r.created_at as string).slice(0, 10)
    const b = buckets.get(key); if (!b) continue
    b.purchases += centsToEur(r.amount_paid as number | null)
  }

  for (const r of subs.data ?? []) {
    const pt = r.plan_type as keyof typeof PLAN_PRICES_EUR | null
    if (!pt) continue
    const key = (r.created_at as string).slice(0, 10)
    const b = buckets.get(key); if (!b) continue
    b.subscriptions += PLAN_PRICES_EUR[pt] ?? 0
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add utils/admin/queries.ts
git commit -m "feat(admin): add daily revenue timeseries fetcher"
```

### Task 3.3: `AdminRevenueChart` client component

**Files:**
- Create: `components/admin/AdminRevenueChart.tsx`
- Create: `components/admin/AdminRevenueChart.module.css`

- [ ] **Step 1: Implement `AdminRevenueChart.tsx`**

```typescript
'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import styles from './AdminRevenueChart.module.css'
import type { RevenueDay } from '@/utils/admin/queries'

type Props = { data: RevenueDay[]; range: 30 | 90 }

export default function AdminRevenueChart({ data, range }: Props) {
  const [, startTransition] = useTransition()
  const router = useRouter()
  const params = useSearchParams()
  const [activeRange, setActiveRange] = useState<30 | 90>(range)

  const total = useMemo(
    () => data.reduce((s, d) => s + d.purchases + d.subscriptions, 0),
    [data]
  )

  function setRange(next: 30 | 90) {
    setActiveRange(next)
    const sp = new URLSearchParams(params?.toString() ?? '')
    sp.set('range', String(next))
    startTransition(() => router.replace(`?${sp.toString()}`))
  }

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Ingresos</h2>
          <p className={styles.sub}>
            Total {activeRange}d: <strong>€{total.toFixed(0)}</strong>
          </p>
        </div>
        <div role="tablist" className={styles.tabs}>
          <button
            type="button"
            role="tab"
            aria-selected={activeRange === 30}
            className={`${styles.tab} ${activeRange === 30 ? styles.tabActive : ''}`}
            onClick={() => setRange(30)}
          >
            30d
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeRange === 90}
            className={`${styles.tab} ${activeRange === 90 ? styles.tabActive : ''}`}
            onClick={() => setRange(90)}
          >
            90d
          </button>
        </div>
      </header>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="purchasesG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(var(--primary-rgb), 1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="rgba(var(--primary-rgb), 1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="subsG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(var(--primary-rgb), 1)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="rgba(var(--primary-rgb), 1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(d: string) => d.slice(5)}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis tick={{ fontSize: 11 }} width={36} />
            <Tooltip
              formatter={(v: number) => `€${Number(v).toFixed(0)}`}
              labelFormatter={(d) => `${d}`}
            />
            <Area
              type="monotone"
              dataKey="subscriptions"
              stackId="1"
              stroke="rgba(var(--primary-rgb), 0.65)"
              fill="url(#subsG)"
              name="Suscripciones"
            />
            <Area
              type="monotone"
              dataKey="purchases"
              stackId="1"
              stroke="rgba(var(--primary-rgb), 1)"
              fill="url(#purchasesG)"
              name="Compras"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement CSS module**

```css
.card {
  background: rgba(var(--primary-rgb), 0.03);
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  border-radius: 10px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.header { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
.title { font-size: 0.95rem; font-weight: 600; margin: 0; }
.sub { margin: 0.1rem 0 0; font-size: 0.8rem; color: rgba(var(--text-rgb, 30, 30, 30), 0.7); }

.tabs { display: inline-flex; border: 1px solid rgba(var(--primary-rgb), 0.18); border-radius: 6px; padding: 2px; }
.tab {
  background: transparent; border: 0; cursor: pointer;
  padding: 0.3rem 0.7rem; font-size: 0.8rem;
  color: rgba(var(--text-rgb, 30, 30, 30), 0.7);
  border-radius: 4px;
}
.tabActive { background: rgba(var(--primary-rgb), 0.15); color: rgba(var(--primary-rgb), 1); font-weight: 600; }

.chartWrap { width: 100%; }
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/AdminRevenueChart.tsx components/admin/AdminRevenueChart.module.css
git commit -m "feat(admin): add AdminRevenueChart with 30d/90d toggle"
```

### Task 3.4: Wire chart into overview page

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Read range from `searchParams`, fetch series, render chart**

At the top of `app/admin/page.tsx`, change the page signature to read `searchParams`:

```typescript
export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const sp = await searchParams
  const range: 30 | 90 = sp.range === '90' ? 90 : 30

  const [k, latestStudents, recentPayments, activeCourses, revenueSeries] = await Promise.all([
    getOverviewKpis(),
    getLatestStudents(),
    getRecentPayments(),
    getActiveCourses(),
    getRevenueTimeseries(range),
  ])
  // ... rest unchanged
```

Add the import:
```typescript
import { getRevenueTimeseries } from '@/utils/admin/queries'
import AdminRevenueChart from '@/components/admin/AdminRevenueChart'
```

Insert the chart section between the KPI grid and the lists section:

```tsx
<section aria-label="Tendencia de ingresos">
  <AdminRevenueChart data={revenueSeries} range={range} />
</section>
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev`. Visit `/admin`. Confirm the chart renders. Click `90d` toggle — URL updates to `?range=90` and chart re-renders.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): wire revenue chart into overview"
```

---

## Phase 4 — Students list `/admin/alumnos`

### Task 4.1: `listStudents()` query

**Files:**
- Modify: `utils/admin/queries.ts`

- [ ] **Step 1: Append `listStudents()` and types**

```typescript
export type StudentRole = 'member' | 'premium' | 'admin'
export type SubFilter = 'all' | 'active' | 'none' | 'newMonth'
export type SortKey = 'created' | 'recent' | 'name'

export type StudentRow = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  role: StudentRole
  created_at: string
  lastActivity: string | null
  subPlan: string | null
  subPeriodEnd: string | null
}

const PAGE_SIZE = 25

export async function listStudents(args: {
  q?: string
  role?: StudentRole | 'all'
  sub?: SubFilter
  sort?: SortKey
  page?: number
}): Promise<{ rows: StudentRow[]; total: number; pageSize: number }> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const page = Math.max(1, args.page ?? 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let q = sb.from('profiles')
    .select('id, full_name, email, avatar_url, role, updated_at, subscriptions(plan_type, status, current_period_end)', { count: 'exact' })

  if (args.q && args.q.trim()) {
    const term = `%${args.q.trim().replace(/[%_]/g, m => '\\' + m)}%`
    q = q.or(`full_name.ilike.${term},email.ilike.${term}`)
  }
  if (args.role && args.role !== 'all') {
    q = q.eq('role', args.role)
  }
  if (args.sub === 'newMonth') {
    const monthStart = new Date()
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
    q = q.gte('updated_at', monthStart.toISOString())
  }

  switch (args.sort) {
    case 'name': q = q.order('full_name', { ascending: true, nullsFirst: false }); break
    case 'recent': q = q.order('updated_at', { ascending: false }); break
    case 'created':
    default:
      q = q.order('updated_at', { ascending: false })
  }

  q = q.range(from, to)

  const { data, count, error } = await q
  if (error) throw error

  type RawSub = { plan_type: string | null; status: string | null; current_period_end: string | null }
  type RawRow = {
    id: string; full_name: string | null; email: string | null; avatar_url: string | null
    role: StudentRole; updated_at: string
    subscriptions: RawSub[] | RawSub | null
  }

  let rows: StudentRow[] = ((data ?? []) as RawRow[]).map((r) => {
    const subs = Array.isArray(r.subscriptions) ? r.subscriptions : r.subscriptions ? [r.subscriptions] : []
    const active = subs.find(s => s.status === 'active' || s.status === 'trialing') ?? null
    return {
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      avatar_url: r.avatar_url,
      role: r.role,
      created_at: r.updated_at,
      lastActivity: r.updated_at,
      subPlan: active?.plan_type ?? null,
      subPeriodEnd: active?.current_period_end ?? null,
    }
  })

  if (args.sub === 'active') rows = rows.filter(r => r.subPlan !== null)
  if (args.sub === 'none') rows = rows.filter(r => r.subPlan === null)

  return { rows, total: count ?? rows.length, pageSize: PAGE_SIZE }
}
```

> **Note:** Filtering by sub status post-query keeps the page-size accurate for the current page only; for v1 (tens-to-hundreds of students) this is fine. If we ever need exact server-side filtering by sub status, we'd add a SQL view.

- [ ] **Step 2: Commit**

```bash
git add utils/admin/queries.ts
git commit -m "feat(admin): add listStudents query with search/filter/sort"
```

### Task 4.2: `StudentsToolbar` component (search + filters)

**Files:**
- Create: `components/admin/StudentsToolbar.tsx`
- Create: `components/admin/StudentsToolbar.module.css`

- [ ] **Step 1: Implement `StudentsToolbar.tsx`**

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import styles from './StudentsToolbar.module.css'

export default function StudentsToolbar({
  initialQ, initialRole, initialSub,
}: { initialQ: string; initialRole: string; initialSub: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [q, setQ] = useState(initialQ)

  function update(patch: Record<string, string>) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v === 'all') sp.delete(k)
      else sp.set(k, v)
    })
    sp.delete('page')
    startTransition(() => router.replace(`?${sp.toString()}`))
  }

  let typingTimer: ReturnType<typeof setTimeout> | null = null
  function onSearchChange(v: string) {
    setQ(v)
    if (typingTimer) clearTimeout(typingTimer)
    typingTimer = setTimeout(() => update({ q: v }), 300)
  }

  return (
    <div className={styles.bar}>
      <label className={styles.search}>
        <Search size={14} aria-hidden />
        <input
          type="search"
          placeholder="Buscar nombre o email…"
          defaultValue={q}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar alumnos"
        />
      </label>

      <select
        defaultValue={initialRole}
        onChange={(e) => update({ role: e.target.value })}
        aria-label="Filtrar por rol"
        className={styles.select}
      >
        <option value="all">Rol: Todos</option>
        <option value="member">Member</option>
        <option value="premium">Premium</option>
        <option value="admin">Admin</option>
      </select>

      <select
        defaultValue={initialSub}
        onChange={(e) => update({ sub: e.target.value })}
        aria-label="Filtrar por suscripción"
        className={styles.select}
      >
        <option value="all">Suscripción: Todas</option>
        <option value="active">Activa</option>
        <option value="none">Sin suscripción</option>
        <option value="newMonth">Nuevos del mes</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 2: CSS**

```css
.bar {
  display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center;
  margin: 0.5rem 0 1rem;
}

.search {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: 6px; flex: 1; min-width: 220px;
  background: var(--background);
  color: rgba(var(--text-rgb, 30, 30, 30), 0.65);
}
.search input { border: 0; outline: 0; background: transparent; flex: 1; color: var(--text-main); font-size: 0.9rem; }

.select {
  padding: 0.5rem 0.7rem;
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: 6px;
  background: var(--background);
  font-size: 0.88rem; color: var(--text-main); cursor: pointer;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/StudentsToolbar.tsx components/admin/StudentsToolbar.module.css
git commit -m "feat(admin): add students toolbar (search + filters)"
```

### Task 4.3: `StudentsTable` component

**Files:**
- Create: `components/admin/StudentsTable.tsx`
- Create: `components/admin/StudentsTable.module.css`
- Create: `__tests__/components/admin-students-table.test.tsx`

- [ ] **Step 1: Write component test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StudentsTable from '@/components/admin/StudentsTable'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/admin/alumnos',
}))

describe('StudentsTable', () => {
  it('renders one row per student', () => {
    const rows = [
      { id: 'a', full_name: 'Ana', email: 'ana@x.com', avatar_url: null,
        role: 'member' as const, created_at: '2026-04-01T00:00:00Z',
        lastActivity: '2026-04-25T00:00:00Z', subPlan: null, subPeriodEnd: null },
      { id: 'b', full_name: 'Bob', email: 'b@x.com', avatar_url: null,
        role: 'admin' as const, created_at: '2026-04-02T00:00:00Z',
        lastActivity: '2026-04-26T00:00:00Z', subPlan: '6months', subPeriodEnd: '2026-10-02T00:00:00Z' },
    ]
    render(<StudentsTable rows={rows} sort="created" />)
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('navigates on row click', () => {
    const rows = [{
      id: 'a', full_name: 'Ana', email: 'ana@x.com', avatar_url: null,
      role: 'member' as const, created_at: '2026-04-01T00:00:00Z',
      lastActivity: '2026-04-25T00:00:00Z', subPlan: null, subPeriodEnd: null,
    }]
    render(<StudentsTable rows={rows} sort="created" />)
    fireEvent.click(screen.getByText('Ana').closest('tr')!)
    expect(push).toHaveBeenCalledWith('/admin/alumnos/a')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/admin-students-table.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `StudentsTable.tsx`**

```typescript
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { StudentRow, SortKey } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from './StudentsTable.module.css'

const PLAN_LABEL: Record<string, string> = {
  '1month': 'Mensual', '6months': '6 meses', '1year': 'Anual',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' })
}

export default function StudentsTable({
  rows, sort,
}: { rows: StudentRow[]; sort: SortKey }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setSort(next: SortKey) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    sp.set('sort', next)
    router.replace(`${pathname}?${sp.toString()}`)
  }

  function sortLabel(key: SortKey, label: string) {
    return (
      <button
        type="button"
        className={`${styles.sortBtn} ${sort === key ? styles.sortActive : ''}`}
        onClick={() => setSort(key)}
      >
        {label} {sort === key ? '↓' : ''}
      </button>
    )
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thAvatar}></th>
            <th>{sortLabel('name', 'Nombre')}</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Suscripción</th>
            <th>{sortLabel('created', 'Alta')}</th>
            <th>{sortLabel('recent', 'Última actividad')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className={styles.empty}>No hay alumnos con esos filtros.</td></tr>
          )}
          {rows.map(r => (
            <tr
              key={r.id}
              onClick={() => router.push(`/admin/alumnos/${r.id}`)}
              className={styles.row}
            >
              <td className={styles.tdAvatar}>
                {r.avatar_url
                  ? <Image src={r.avatar_url} alt="" width={28} height={28} className={styles.avatar} />
                  : <span className={styles.avatarFallback} aria-hidden />}
              </td>
              <td className={styles.tdName}>
                <Link href={`/admin/alumnos/${r.id}`} onClick={e => e.stopPropagation()}>
                  {r.full_name ?? 'Sin nombre'}
                </Link>
              </td>
              <td className={styles.tdEmail}>{r.email ?? '—'}</td>
              <td><span className={`${styles.badge} ${styles[`role_${r.role}`]}`}>{r.role}</span></td>
              <td>
                {r.subPlan
                  ? <span className={styles.subActive}>✓ {PLAN_LABEL[r.subPlan] ?? r.subPlan}</span>
                  : <span className={styles.subNone}>—</span>}
              </td>
              <td>{formatDate(r.created_at)}</td>
              <td>{r.lastActivity ? formatRelative(r.lastActivity) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: CSS**

```css
.tableWrap { overflow-x: auto; border: 1px solid rgba(var(--primary-rgb), 0.1); border-radius: 10px; }

.table { width: 100%; border-collapse: collapse; min-width: 720px; }

.table th {
  text-align: left;
  padding: 0.7rem 0.85rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(var(--text-rgb, 30, 30, 30), 0.55);
  background: rgba(var(--primary-rgb), 0.04);
  border-bottom: 1px solid rgba(var(--primary-rgb), 0.1);
  font-weight: 500;
}

.thAvatar { width: 44px; }

.row { cursor: pointer; transition: background-color 100ms; }
.row:hover { background: rgba(var(--primary-rgb), 0.05); }

.table td {
  padding: 0.65rem 0.85rem;
  font-size: 0.88rem;
  border-bottom: 1px solid rgba(var(--primary-rgb), 0.06);
  vertical-align: middle;
}

.tdAvatar { padding-right: 0; }
.tdName a { color: var(--text-main); text-decoration: none; font-weight: 500; }
.tdName a:hover { text-decoration: underline; }
.tdEmail { color: rgba(var(--text-rgb, 30, 30, 30), 0.7); white-space: nowrap; max-width: 240px; overflow: hidden; text-overflow: ellipsis; }

.avatar, .avatarFallback {
  width: 28px; height: 28px; border-radius: 50%;
  object-fit: cover; background: rgba(var(--primary-rgb), 0.12);
}

.badge {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  background: rgba(var(--primary-rgb), 0.1);
  color: rgba(var(--primary-rgb), 1);
  text-transform: capitalize;
}
.role_admin { background: rgba(180, 60, 60, 0.12); color: rgba(180, 60, 60, 1); }
.role_premium { background: rgba(40, 140, 70, 0.12); color: rgba(40, 140, 70, 1); }

.subActive { color: rgba(40, 140, 70, 1); font-size: 0.85rem; }
.subNone { color: rgba(var(--text-rgb, 30, 30, 30), 0.45); }

.sortBtn { background: transparent; border: 0; cursor: pointer; padding: 0; font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit; }
.sortBtn:hover { text-decoration: underline; }
.sortActive { color: rgba(var(--primary-rgb), 1); }

.empty { text-align: center; padding: 1.5rem; color: rgba(var(--text-rgb, 30, 30, 30), 0.55); }
```

- [ ] **Step 5: Run test — passes**

Run: `npx vitest run __tests__/components/admin-students-table.test.tsx`
Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add components/admin/StudentsTable.tsx components/admin/StudentsTable.module.css __tests__/components/admin-students-table.test.tsx
git commit -m "feat(admin): add StudentsTable with sortable headers"
```

### Task 4.4: `/admin/alumnos/page.tsx` listing page with pagination

**Files:**
- Create: `app/admin/alumnos/page.tsx`
- Create: `app/admin/alumnos/alumnos.module.css`

- [ ] **Step 1: Implement page**

```typescript
import Link from 'next/link'
import StudentsToolbar from '@/components/admin/StudentsToolbar'
import StudentsTable from '@/components/admin/StudentsTable'
import { listStudents, type StudentRole, type SubFilter, type SortKey } from '@/utils/admin/queries'
import styles from './alumnos.module.css'

export const dynamic = 'force-dynamic'

const VALID_ROLES = new Set(['member', 'premium', 'admin', 'all'])
const VALID_SUBS = new Set(['active', 'none', 'newMonth', 'all'])
const VALID_SORT = new Set(['created', 'recent', 'name'])

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const q = sp.q ?? ''
  const role = (VALID_ROLES.has(sp.role ?? '') ? (sp.role as StudentRole | 'all') : 'all') as StudentRole | 'all'
  const sub = (VALID_SUBS.has(sp.sub ?? '') ? (sp.sub as SubFilter) : 'all') as SubFilter
  const sort = (VALID_SORT.has(sp.sort ?? '') ? (sp.sort as SortKey) : 'created') as SortKey
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  const { rows, total, pageSize } = await listStudents({ q, role, sub, sort, page })
  const pages = Math.max(1, Math.ceil(total / pageSize))

  function pageHref(p: number) {
    const u = new URLSearchParams()
    if (q) u.set('q', q)
    if (role !== 'all') u.set('role', role)
    if (sub !== 'all') u.set('sub', sub)
    if (sort !== 'created') u.set('sort', sort)
    if (p > 1) u.set('page', String(p))
    return `?${u.toString()}`
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Alumnos <span className={styles.count}>({total})</span></h1>
      </header>

      <StudentsToolbar initialQ={q} initialRole={role} initialSub={sub} />

      <StudentsTable rows={rows} sort={sort} />

      {pages > 1 && (
        <nav className={styles.pagination} aria-label="Paginación">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page === 1}
            className={`${styles.pageBtn} ${page === 1 ? styles.disabled : ''}`}
          >
            ← Anterior
          </Link>
          <span className={styles.pageInfo}>Página {page} de {pages}</span>
          <Link
            href={pageHref(Math.min(pages, page + 1))}
            aria-disabled={page === pages}
            className={`${styles.pageBtn} ${page === pages ? styles.disabled : ''}`}
          >
            Siguiente →
          </Link>
        </nav>
      )}
    </div>
  )
}
```

- [ ] **Step 2: CSS**

```css
.container { display: flex; flex-direction: column; gap: 0.5rem; }

.header { display: flex; align-items: baseline; justify-content: space-between; }
.title { font-size: clamp(1.4rem, 2.5vw, 1.8rem); margin: 0; font-weight: 600; }
.count { font-weight: 400; color: rgba(var(--text-rgb, 30, 30, 30), 0.55); font-size: 0.85em; }

.pagination {
  margin-top: 0.85rem;
  display: flex; align-items: center; gap: 0.75rem; justify-content: center;
}

.pageBtn {
  padding: 0.45rem 0.9rem;
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: 6px;
  text-decoration: none;
  color: var(--text-main);
  font-size: 0.85rem;
  background: var(--background);
}

.pageBtn:hover { background: rgba(var(--primary-rgb), 0.06); }

.disabled {
  pointer-events: none;
  opacity: 0.5;
}

.pageInfo { font-size: 0.85rem; color: rgba(var(--text-rgb, 30, 30, 30), 0.65); }
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`. Visit `/admin/alumnos`. Confirm:
- The table renders with all alumnos.
- Searching narrows results.
- Filters work.
- Sort headers reorder.
- Paginación appears if you have >25 alumnos.

- [ ] **Step 4: Commit**

```bash
git add app/admin/alumnos/page.tsx app/admin/alumnos/alumnos.module.css
git commit -m "feat(admin): add students list page with search, filters, pagination"
```

---

## Phase 5 — Student detail `/admin/alumnos/[id]` + admin actions

### Task 5.1: `getStudentDetail()` query

**Files:**
- Modify: `utils/admin/queries.ts`

- [ ] **Step 1: Append `getStudentDetail()`**

```typescript
export type StudentDetail = {
  profile: {
    id: string; full_name: string | null; email: string | null
    avatar_url: string | null; role: StudentRole
    bio: string | null
    instagram: string | null; facebook: string | null
    tiktok: string | null; youtube: string | null
    created_at: string
    stripe_customer_id: string | null
  }
  subscription: {
    plan_type: string | null; status: string | null
    current_period_start: string | null; current_period_end: string | null
  } | null
  purchases: Array<{
    id: string; course_id: string; course_title: string
    amount_paid: number | null; created_at: string
  }>
  membershipCourses: Array<{ id: string; title: string }>
  lessonProgress: Array<{
    course_id: string; course_title: string
    total: number; completed: number
    lessons: Array<{ id: string; title: string; completed: boolean; updated_at: string | null }>
  }>
  submissions: Array<{
    id: string; assignment_id: string; lesson_id: string; course_id: string
    course_title: string; lesson_title: string; assignment_title: string
    status: string; grade: string | null; feedback: string | null
    created_at: string; updated_at: string
  }>
  community: {
    posts: Array<{ id: string; content: string; created_at: string }>
    comments: Array<{ id: string; content: string; post_id: string; created_at: string }>
  }
}

export async function getStudentDetail(userId: string): Promise<StudentDetail | null> {
  await requireAdmin()
  const sb = createSupabaseAdmin()

  const profileRes = await sb
    .from('profiles')
    .select('id, full_name, email, avatar_url, role, bio, instagram, facebook, tiktok, youtube, updated_at, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  if (!profileRes.data) return null

  const [subRes, purchasesRes, allCoursesRes, progressRes, submissionsRes, postsRes, commentsRes] = await Promise.all([
    sb.from('subscriptions')
      .select('plan_type, status, current_period_start, current_period_end')
      .eq('user_id', userId)
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('course_purchases')
      .select('id, course_id, amount_paid, created_at, courses(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    sb.from('courses').select('id, title, course_type, month, year, is_published'),
    sb.from('lesson_progress')
      .select('lesson_id, is_completed, updated_at, lessons(id, title, course_id, courses(id, title))')
      .eq('user_id', userId),
    sb.from('submissions')
      .select('id, assignment_id, status, grade, feedback, created_at, updated_at, assignments(title, lesson_id, course_id, lessons(title), courses(title))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    sb.from('posts').select('id, content, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    sb.from('comments').select('id, content, post_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ])

  const pickFirst = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  // Membership courses derived from active subscription period
  const sub = subRes.data
  const membershipCourses: { id: string; title: string }[] = []
  if (sub?.status === 'active' || sub?.status === 'trialing') {
    const start = sub.current_period_start ? new Date(sub.current_period_start) : null
    const end = sub.current_period_end ? new Date(sub.current_period_end) : null
    for (const c of (allCoursesRes.data ?? []) as Array<{
      id: string; title: string; course_type: string; month: number | null; year: number | null; is_published: boolean
    }>) {
      if (c.course_type !== 'membership' || !c.is_published || !c.month || !c.year) continue
      const first = new Date(Date.UTC(c.year, c.month - 1, 1))
      const last = new Date(Date.UTC(c.year, c.month, 0, 23, 59, 59))
      if (start && end && start <= last && end >= first) {
        membershipCourses.push({ id: c.id, title: c.title })
      }
    }
  }

  // Lesson progress aggregation per course
  type ProgRow = {
    lesson_id: string; is_completed: boolean | null; updated_at: string | null
    lessons: {
      id: string; title: string; course_id: string;
      courses: { id: string; title: string } | { id: string; title: string }[] | null
    } | { id: string; title: string; course_id: string;
      courses: { id: string; title: string } | { id: string; title: string }[] | null
    }[] | null
  }
  const progressByCourse = new Map<string, StudentDetail['lessonProgress'][number]>()
  for (const r of (progressRes.data ?? []) as ProgRow[]) {
    const lesson = pickFirst(r.lessons)
    if (!lesson) continue
    const course = pickFirst(lesson.courses)
    if (!course) continue
    let bucket = progressByCourse.get(course.id)
    if (!bucket) {
      bucket = { course_id: course.id, course_title: course.title, total: 0, completed: 0, lessons: [] }
      progressByCourse.set(course.id, bucket)
    }
    bucket.total += 1
    if (r.is_completed) bucket.completed += 1
    bucket.lessons.push({
      id: lesson.id, title: lesson.title,
      completed: !!r.is_completed, updated_at: r.updated_at,
    })
  }

  type SubmRow = {
    id: string; assignment_id: string; status: string;
    grade: string | null; feedback: string | null
    created_at: string; updated_at: string
    assignments: {
      title: string; lesson_id: string; course_id: string;
      lessons: { title: string } | { title: string }[] | null
      courses: { title: string } | { title: string }[] | null
    } | { title: string; lesson_id: string; course_id: string;
      lessons: { title: string } | { title: string }[] | null
      courses: { title: string } | { title: string }[] | null
    }[] | null
  }

  type PurchaseRow = {
    id: string; course_id: string; amount_paid: number | null; created_at: string;
    courses: { title: string } | { title: string }[] | null
  }

  return {
    profile: {
      id: profileRes.data.id as string,
      full_name: profileRes.data.full_name as string | null,
      email: profileRes.data.email as string | null,
      avatar_url: profileRes.data.avatar_url as string | null,
      role: profileRes.data.role as StudentRole,
      bio: profileRes.data.bio as string | null,
      instagram: profileRes.data.instagram as string | null,
      facebook: profileRes.data.facebook as string | null,
      tiktok: profileRes.data.tiktok as string | null,
      youtube: profileRes.data.youtube as string | null,
      created_at: profileRes.data.updated_at as string,
      stripe_customer_id: profileRes.data.stripe_customer_id as string | null,
    },
    subscription: sub ?? null,
    purchases: ((purchasesRes.data ?? []) as PurchaseRow[]).map((p) => ({
      id: p.id, course_id: p.course_id,
      course_title: pickFirst(p.courses)?.title ?? '—',
      amount_paid: p.amount_paid, created_at: p.created_at,
    })),
    membershipCourses,
    lessonProgress: [...progressByCourse.values()],
    submissions: ((submissionsRes.data ?? []) as SubmRow[]).map((s) => {
      const a = pickFirst(s.assignments)
      return {
        id: s.id, assignment_id: s.assignment_id,
        lesson_id: a?.lesson_id ?? '', course_id: a?.course_id ?? '',
        course_title: pickFirst(a?.courses)?.title ?? '—',
        lesson_title: pickFirst(a?.lessons)?.title ?? '—',
        assignment_title: a?.title ?? '—',
        status: s.status, grade: s.grade, feedback: s.feedback,
        created_at: s.created_at, updated_at: s.updated_at,
      }
    }),
    community: {
      posts: (postsRes.data ?? []).map(p => ({ id: p.id as string, content: p.content as string, created_at: p.created_at as string })),
      comments: (commentsRes.data ?? []).map(c => ({ id: c.id as string, content: c.content as string, post_id: c.post_id as string, created_at: c.created_at as string })),
    },
  }
}
```

> **Note on `bio` etc.:** these columns may not all exist yet on `profiles`. If a select fails, the profile row will still come back from the maybeSingle — but if a column doesn't exist, the query will error. **Before running** this, verify `profiles` has `bio`, `instagram`, `facebook`, `tiktok`, `youtube` (per `add_social_links.sql`). If `bio` is missing, drop it from the select. Adjust the `select` to match the real schema.

- [ ] **Step 2: Verify schema**

Run: `grep -E "bio|instagram|facebook|tiktok|youtube" supabase/*.sql`. If any column is absent, remove from the select.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add utils/admin/queries.ts
git commit -m "feat(admin): add student detail query with progress, submissions, community"
```

### Task 5.2: Detail page shell + summary card

**Files:**
- Create: `app/admin/alumnos/[id]/page.tsx`
- Create: `components/admin/StudentDetail/StudentSummaryCard.tsx`
- Create: `components/admin/StudentDetail/StudentDetail.module.css`

- [ ] **Step 1: Implement summary card**

`components/admin/StudentDetail/StudentSummaryCard.tsx`:

```typescript
import Image from 'next/image'
import { safeSocialUrl } from '@/utils/sanitize'
import { formatRelative } from '@/utils/admin/metrics'
import type { StudentDetail } from '@/utils/admin/queries'
import styles from './StudentDetail.module.css'

const PLAN_LABEL: Record<string, string> = { '1month': 'Mensual', '6months': '6 meses', '1year': 'Anual' }

export default function StudentSummaryCard({ data }: { data: StudentDetail }) {
  const p = data.profile
  const sub = data.subscription
  const isActive = sub && (sub.status === 'active' || sub.status === 'trialing')
  const socials: Array<['instagram' | 'facebook' | 'tiktok' | 'youtube', string | null]> = [
    ['instagram', p.instagram], ['facebook', p.facebook], ['tiktok', p.tiktok], ['youtube', p.youtube],
  ]

  return (
    <aside className={styles.summary}>
      <div className={styles.summaryHead}>
        {p.avatar_url
          ? <Image src={p.avatar_url} alt="" width={64} height={64} className={styles.avatar} />
          : <span className={styles.avatarFallback} aria-hidden />}
        <div>
          <h2 className={styles.name}>{p.full_name ?? 'Sin nombre'}</h2>
          <p className={styles.email}>{p.email}</p>
          <p className={styles.meta}>
            <span className={`${styles.roleBadge} ${styles[`role_${p.role}`]}`}>{p.role}</span>
            {' · alta '}{formatRelative(p.created_at)}
          </p>
        </div>
      </div>

      <section className={styles.summaryBlock}>
        <h3>Suscripción</h3>
        {isActive ? (
          <>
            <p>✓ {sub?.plan_type ? (PLAN_LABEL[sub.plan_type] ?? sub.plan_type) : 'Activa'}</p>
            <p className={styles.dim}>
              {sub?.current_period_start?.slice(0, 10)} → {sub?.current_period_end?.slice(0, 10)}
            </p>
            {p.stripe_customer_id && (
              <a
                href={`https://dashboard.stripe.com/customers/${p.stripe_customer_id}`}
                target="_blank" rel="noopener noreferrer"
                className={styles.link}
              >
                Stripe ↗
              </a>
            )}
          </>
        ) : (
          <p className={styles.dim}>Sin suscripción activa</p>
        )}
      </section>

      <section className={styles.summaryBlock}>
        <h3>Redes</h3>
        {socials.every(([, v]) => !v) && <p className={styles.dim}>Sin redes.</p>}
        <ul className={styles.socials}>
          {socials.map(([key, val]) => {
            const safe = safeSocialUrl(val, key)
            if (!safe) return null
            return (
              <li key={key}>
                <a href={safe} target="_blank" rel="noopener noreferrer" className={styles.link}>{key} ↗</a>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}
```

- [ ] **Step 2: Verify `safeSocialUrl` signature**

Run: `grep -n "export function safeSocialUrl" utils/sanitize.ts` and adjust the call signature in the component above to match. If the helper takes only one arg, drop the second arg.

- [ ] **Step 3: Implement the detail page (without tabs yet)**

`app/admin/alumnos/[id]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import StudentSummaryCard from '@/components/admin/StudentDetail/StudentSummaryCard'
import { getStudentDetail } from '@/utils/admin/queries'
import styles from '@/components/admin/StudentDetail/StudentDetail.module.css'

export const dynamic = 'force-dynamic'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getStudentDetail(id)
  if (!data) notFound()

  return (
    <div className={styles.page}>
      <StudentSummaryCard data={data} />
      <main className={styles.tabsPane}>
        {/* Tabs added in next task */}
        <p>Datos cargados — pestañas en construcción.</p>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Implement CSS module**

`components/admin/StudentDetail/StudentDetail.module.css`:

```css
.page {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 1024px) { .page { grid-template-columns: 1fr; } }

.summary {
  background: rgba(var(--primary-rgb), 0.03);
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  border-radius: 10px;
  padding: 1.25rem;
  display: flex; flex-direction: column; gap: 1rem;
  position: sticky; top: 1rem;
}

@media (max-width: 1024px) { .summary { position: static; } }

.summaryHead { display: flex; gap: 0.85rem; align-items: flex-start; }
.avatar, .avatarFallback {
  width: 64px; height: 64px; border-radius: 50%;
  object-fit: cover; background: rgba(var(--primary-rgb), 0.12);
  flex-shrink: 0;
}

.name { font-size: 1.05rem; margin: 0; font-weight: 600; }
.email { font-size: 0.82rem; margin: 0.15rem 0 0; color: rgba(var(--text-rgb, 30, 30, 30), 0.7); word-break: break-all; }
.meta { font-size: 0.78rem; margin: 0.35rem 0 0; color: rgba(var(--text-rgb, 30, 30, 30), 0.65); }

.roleBadge {
  display: inline-block;
  padding: 0.05rem 0.45rem; border-radius: 999px;
  background: rgba(var(--primary-rgb), 0.1); color: rgba(var(--primary-rgb), 1);
  font-size: 0.7rem; text-transform: capitalize;
}
.role_admin { background: rgba(180, 60, 60, 0.12); color: rgba(180, 60, 60, 1); }
.role_premium { background: rgba(40, 140, 70, 0.12); color: rgba(40, 140, 70, 1); }

.summaryBlock h3 {
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em;
  color: rgba(var(--text-rgb, 30, 30, 30), 0.55);
  margin: 0 0 0.4rem;
  font-weight: 500;
}
.summaryBlock p { margin: 0.15rem 0; font-size: 0.85rem; }
.dim { color: rgba(var(--text-rgb, 30, 30, 30), 0.55); }
.link { color: rgba(var(--primary-rgb), 1); text-decoration: none; font-size: 0.85rem; }
.link:hover { text-decoration: underline; }

.socials { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.2rem; }

.tabsPane {
  background: rgba(var(--primary-rgb), 0.03);
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  border-radius: 10px;
  padding: 1.25rem;
  min-width: 0;
}

.tabBar { display: flex; gap: 0.25rem; border-bottom: 1px solid rgba(var(--primary-rgb), 0.12); margin-bottom: 1rem; flex-wrap: wrap; }
.tabBtn { background: transparent; border: 0; cursor: pointer; padding: 0.55rem 0.85rem; font-size: 0.88rem; color: rgba(var(--text-rgb, 30, 30, 30), 0.65); border-bottom: 2px solid transparent; }
.tabBtn:hover { color: var(--text-main); }
.tabActive { color: var(--text-main); border-bottom-color: rgba(var(--primary-rgb), 1); font-weight: 500; }

.subList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.courseRow { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.6rem 0.75rem; border: 1px solid rgba(var(--primary-rgb), 0.08); border-radius: 6px; }
.progressBar { height: 4px; background: rgba(var(--primary-rgb), 0.1); border-radius: 999px; overflow: hidden; }
.progressFill { height: 100%; background: rgba(var(--primary-rgb), 1); }

.lessonsList { list-style: none; margin: 0.4rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.83rem; }
.lessonItem { display: flex; gap: 0.5rem; align-items: center; }
.lessonDone { color: rgba(40, 140, 70, 1); }

.subItemTable { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.subItemTable th, .subItemTable td { padding: 0.5rem 0.6rem; border-bottom: 1px solid rgba(var(--primary-rgb), 0.06); text-align: left; }
.subItemTable th { font-weight: 500; color: rgba(var(--text-rgb, 30, 30, 30), 0.6); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em; }

.statusPending { color: rgba(200, 140, 30, 1); }
.statusReviewed { color: rgba(40, 140, 70, 1); }

.commPost { padding: 0.6rem 0.75rem; border: 1px solid rgba(var(--primary-rgb), 0.08); border-radius: 6px; }
.commContent { font-size: 0.85rem; margin: 0; }
.commMeta { font-size: 0.75rem; color: rgba(var(--text-rgb, 30, 30, 30), 0.55); margin: 0.25rem 0 0; }

.totalRow { font-weight: 600; }
```

- [ ] **Step 5: Smoke test**

Run: `npm run dev`. Visit `/admin/alumnos/<id>` (any valid ID from the list). Confirm summary card renders.

- [ ] **Step 6: Commit**

```bash
git add app/admin/alumnos/[id]/page.tsx components/admin/StudentDetail/StudentSummaryCard.tsx components/admin/StudentDetail/StudentDetail.module.css
git commit -m "feat(admin): add student detail page shell + summary card"
```

### Task 5.3: `StudentTabs` container + 5 tabs

**Files:**
- Create: `components/admin/StudentDetail/StudentTabs.tsx`
- Create: `components/admin/StudentDetail/TabCursos.tsx`
- Create: `components/admin/StudentDetail/TabProgreso.tsx`
- Create: `components/admin/StudentDetail/TabEntregas.tsx`
- Create: `components/admin/StudentDetail/TabComunidad.tsx`
- Create: `components/admin/StudentDetail/TabPagos.tsx`
- Modify: `app/admin/alumnos/[id]/page.tsx`

- [ ] **Step 1: Implement `StudentTabs.tsx`**

```typescript
'use client'

import { useState, type ReactNode } from 'react'
import styles from './StudentDetail.module.css'

type Tab = { key: string; label: string; content: ReactNode }

export default function StudentTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '')
  const current = tabs.find(t => t.key === active) ?? tabs[0]
  return (
    <div>
      <div role="tablist" className={styles.tabBar}>
        {tabs.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            className={`${styles.tabBtn} ${active === t.key ? styles.tabActive : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `TabCursos.tsx`**

```typescript
import Link from 'next/link'
import { centsToEur } from '@/utils/admin/metrics'
import type { StudentDetail } from '@/utils/admin/queries'
import styles from './StudentDetail.module.css'

export default function TabCursos({ data }: { data: StudentDetail }) {
  const purchaseProgress = (courseId: string) =>
    data.lessonProgress.find(p => p.course_id === courseId)

  return (
    <div className={styles.subList}>
      <h3 className={styles.summaryBlockHeading}>Por compra</h3>
      {data.purchases.length === 0 && <p className={styles.dim}>Sin compras.</p>}
      <ul className={styles.subList}>
        {data.purchases.map(p => {
          const prog = purchaseProgress(p.course_id)
          const pct = prog && prog.total ? Math.round((prog.completed / prog.total) * 100) : 0
          return (
            <li key={p.id} className={styles.courseRow}>
              <Link href={`/courses/${p.course_id}`}>{p.course_title}</Link>
              <small className={styles.dim}>
                €{centsToEur(p.amount_paid).toFixed(0)} · {new Date(p.created_at).toLocaleDateString('es-ES')}
              </small>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
              <small>{pct}% completado</small>
            </li>
          )
        })}
      </ul>

      <h3 className={styles.summaryBlockHeading}>Por suscripción</h3>
      {data.membershipCourses.length === 0 && <p className={styles.dim}>Sin acceso por suscripción.</p>}
      <ul className={styles.subList}>
        {data.membershipCourses.map(c => {
          const prog = purchaseProgress(c.id)
          const pct = prog && prog.total ? Math.round((prog.completed / prog.total) * 100) : 0
          return (
            <li key={c.id} className={styles.courseRow}>
              <Link href={`/courses/${c.id}`}>{c.title}</Link>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
              <small>{pct}% completado</small>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Implement `TabProgreso.tsx`**

```typescript
import type { StudentDetail } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from './StudentDetail.module.css'

export default function TabProgreso({ data }: { data: StudentDetail }) {
  if (data.lessonProgress.length === 0) return <p className={styles.dim}>Sin progreso registrado.</p>
  return (
    <ul className={styles.subList}>
      {data.lessonProgress.map(c => (
        <li key={c.course_id} className={styles.courseRow}>
          <strong>{c.course_title}</strong>
          <small className={styles.dim}>{c.completed} / {c.total} lecciones</small>
          <ul className={styles.lessonsList}>
            {c.lessons.map(l => (
              <li key={l.id} className={styles.lessonItem}>
                <span className={l.completed ? styles.lessonDone : styles.dim}>
                  {l.completed ? '✓' : '○'}
                </span>
                <span>{l.title}</span>
                {l.updated_at && <span className={styles.dim}>· {formatRelative(l.updated_at)}</span>}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Implement `TabEntregas.tsx`**

```typescript
import Link from 'next/link'
import type { StudentDetail } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from './StudentDetail.module.css'

export default function TabEntregas({ data }: { data: StudentDetail }) {
  if (data.submissions.length === 0) return <p className={styles.dim}>Sin entregas.</p>
  return (
    <table className={styles.subItemTable}>
      <thead>
        <tr><th>Tarea</th><th>Curso · Lección</th><th>Estado</th><th>Nota</th><th>Enviada</th><th></th></tr>
      </thead>
      <tbody>
        {data.submissions.map(s => (
          <tr key={s.id}>
            <td>{s.assignment_title}</td>
            <td>{s.course_title} · {s.lesson_title}</td>
            <td>
              <span className={s.status === 'pending' ? styles.statusPending : styles.statusReviewed}>
                {s.status === 'pending' ? 'Pendiente' : 'Revisada'}
              </span>
            </td>
            <td>{s.grade ?? '—'}</td>
            <td>{formatRelative(s.created_at)}</td>
            <td>
              <Link href={`/courses/${s.course_id}/${s.lesson_id}/submissions`} className={styles.link}>
                Abrir →
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 5: Implement `TabComunidad.tsx`**

```typescript
import Link from 'next/link'
import type { StudentDetail } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from './StudentDetail.module.css'

export default function TabComunidad({ data }: { data: StudentDetail }) {
  return (
    <div className={styles.subList}>
      <h3 className={styles.summaryBlockHeading}>Posts</h3>
      {data.community.posts.length === 0 && <p className={styles.dim}>Sin posts.</p>}
      <ul className={styles.subList}>
        {data.community.posts.map(p => (
          <li key={p.id} className={styles.commPost}>
            <p className={styles.commContent}>{p.content.slice(0, 220)}{p.content.length > 220 ? '…' : ''}</p>
            <p className={styles.commMeta}>{formatRelative(p.created_at)}</p>
          </li>
        ))}
      </ul>

      <h3 className={styles.summaryBlockHeading}>Comentarios</h3>
      {data.community.comments.length === 0 && <p className={styles.dim}>Sin comentarios.</p>}
      <ul className={styles.subList}>
        {data.community.comments.map(c => (
          <li key={c.id} className={styles.commPost}>
            <p className={styles.commContent}>{c.content.slice(0, 220)}{c.content.length > 220 ? '…' : ''}</p>
            <p className={styles.commMeta}>
              <Link href={`/community/${c.post_id}`} className={styles.link}>Ver post ↗</Link> · {formatRelative(c.created_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 6: Implement `TabPagos.tsx`**

```typescript
import type { StudentDetail } from '@/utils/admin/queries'
import { centsToEur } from '@/utils/admin/metrics'
import styles from './StudentDetail.module.css'

const PLAN_LABEL: Record<string, string> = { '1month': 'Mensual', '6months': '6 meses', '1year': 'Anual' }

export default function TabPagos({ data }: { data: StudentDetail }) {
  type Row = { date: string; concept: string; amount: number }
  const rows: Row[] = [
    ...data.purchases.map(p => ({
      date: p.created_at,
      concept: `Compra · ${p.course_title}`,
      amount: centsToEur(p.amount_paid),
    })),
  ]

  // Subscription not stored historically per period; show as a single row using current period start.
  if (data.subscription?.current_period_start && data.subscription.plan_type) {
    rows.push({
      date: data.subscription.current_period_start,
      concept: `Suscripción · ${PLAN_LABEL[data.subscription.plan_type] ?? data.subscription.plan_type}`,
      amount: 0, // We don't store the charged amount per period in v1.
    })
  }

  rows.sort((a, b) => b.date.localeCompare(a.date))
  const total = rows.reduce((s, r) => s + r.amount, 0)

  if (rows.length === 0) return <p className={styles.dim}>Sin pagos registrados.</p>

  return (
    <table className={styles.subItemTable}>
      <thead><tr><th>Fecha</th><th>Concepto</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{new Date(r.date).toLocaleDateString('es-ES')}</td>
            <td>{r.concept}</td>
            <td style={{ textAlign: 'right' }}>{r.amount > 0 ? `€${r.amount.toFixed(0)}` : '—'}</td>
          </tr>
        ))}
        <tr className={styles.totalRow}>
          <td colSpan={2}>Total compras</td>
          <td style={{ textAlign: 'right' }}>€{total.toFixed(0)}</td>
        </tr>
      </tbody>
    </table>
  )
}
```

- [ ] **Step 7: Wire tabs into the detail page**

Replace `app/admin/alumnos/[id]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import StudentSummaryCard from '@/components/admin/StudentDetail/StudentSummaryCard'
import StudentTabs from '@/components/admin/StudentDetail/StudentTabs'
import TabCursos from '@/components/admin/StudentDetail/TabCursos'
import TabProgreso from '@/components/admin/StudentDetail/TabProgreso'
import TabEntregas from '@/components/admin/StudentDetail/TabEntregas'
import TabComunidad from '@/components/admin/StudentDetail/TabComunidad'
import TabPagos from '@/components/admin/StudentDetail/TabPagos'
import { getStudentDetail } from '@/utils/admin/queries'
import styles from '@/components/admin/StudentDetail/StudentDetail.module.css'

export const dynamic = 'force-dynamic'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getStudentDetail(id)
  if (!data) notFound()

  return (
    <div className={styles.page}>
      <StudentSummaryCard data={data} />
      <main className={styles.tabsPane}>
        <StudentTabs
          tabs={[
            { key: 'cursos', label: 'Cursos', content: <TabCursos data={data} /> },
            { key: 'progreso', label: 'Progreso', content: <TabProgreso data={data} /> },
            { key: 'entregas', label: 'Entregas', content: <TabEntregas data={data} /> },
            { key: 'comunidad', label: 'Comunidad', content: <TabComunidad data={data} /> },
            { key: 'pagos', label: 'Pagos', content: <TabPagos data={data} /> },
          ]}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 8: Smoke test**

Run: `npm run dev`. Open detail page. Click each tab. Confirm content appears with real data.

- [ ] **Step 9: Commit**

```bash
git add components/admin/StudentDetail app/admin/alumnos/[id]/page.tsx
git commit -m "feat(admin): add 5-tab student detail (cursos/progreso/entregas/comunidad/pagos)"
```

### Task 5.4: Admin actions — server actions module

**Files:**
- Create: `app/admin/alumnos/actions.ts`
- Create: `__tests__/actions/admin-alumnos-actions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockRequireAdmin = vi.fn()
vi.mock('@/utils/admin/guard', () => ({
  requireAdmin: () => mockRequireAdmin(),
  AdminGuardError: class extends Error { constructor(public reason: string) { super(reason) } },
}))

const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockDeleteUser = vi.fn()

vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({
    from: vi.fn().mockImplementation(() => ({
      update: mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      insert: mockInsert.mockResolvedValue({ error: null }),
    })),
    auth: { admin: { deleteUser: mockDeleteUser.mockResolvedValue({ error: null }) } },
  }),
}))

describe('updateUserRole', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRequireAdmin.mockResolvedValue({ id: 'admin-1' }) })

  it('updates role when admin', async () => {
    const { updateUserRole } = await import('@/app/admin/alumnos/actions')
    await updateUserRole('user-1', 'premium')
    expect(mockUpdate).toHaveBeenCalledWith({ role: 'premium' })
  })

  it('rejects invalid role', async () => {
    const { updateUserRole } = await import('@/app/admin/alumnos/actions')
    // @ts-expect-error testing invalid role
    await expect(updateUserRole('u1', 'super')).rejects.toThrow()
  })

  it('throws when not admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const { updateUserRole } = await import('@/app/admin/alumnos/actions')
    await expect(updateUserRole('u1', 'admin')).rejects.toThrow()
  })
})

describe('grantCourseAccess', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRequireAdmin.mockResolvedValue({ id: 'admin-1' }) })

  it('inserts a course_purchases row with manual session id', async () => {
    const { grantCourseAccess } = await import('@/app/admin/alumnos/actions')
    await grantCourseAccess('u1', 'c1')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', course_id: 'c1', amount_paid: 0,
    }))
    const arg = mockInsert.mock.calls[0][0]
    expect(arg.stripe_session_id).toMatch(/^manual_admin_/)
  })
})

describe('sendNotification', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRequireAdmin.mockResolvedValue({ id: 'admin-1' }) })

  it('inserts notification', async () => {
    const { sendNotification } = await import('@/app/admin/alumnos/actions')
    await sendNotification('u1', 'Hola', 'Mensaje')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', title: 'Hola', body: 'Mensaje', type: 'admin_message',
    }))
  })

  it('rejects empty title', async () => {
    const { sendNotification } = await import('@/app/admin/alumnos/actions')
    await expect(sendNotification('u1', '   ', 'b')).rejects.toThrow()
  })
})

describe('deleteUser', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRequireAdmin.mockResolvedValue({ id: 'admin-1' }) })

  it('calls supabase auth admin deleteUser', async () => {
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await deleteUser('u1', 'ELIMINAR')
    expect(mockDeleteUser).toHaveBeenCalledWith('u1')
  })

  it('rejects without typed-confirm phrase', async () => {
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await expect(deleteUser('u1', 'eliminar')).rejects.toThrow()
  })

  it('refuses to delete the calling admin', async () => {
    mockRequireAdmin.mockResolvedValueOnce({ id: 'me' })
    const { deleteUser } = await import('@/app/admin/alumnos/actions')
    await expect(deleteUser('me', 'ELIMINAR')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests — fail**

Run: `npx vitest run __tests__/actions/admin-alumnos-actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `app/admin/alumnos/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/utils/admin/guard'
import { createSupabaseAdmin } from '@/utils/supabase/admin'

const ROLES = ['member', 'premium', 'admin'] as const
type Role = (typeof ROLES)[number]

export async function updateUserRole(userId: string, role: Role) {
  await requireAdmin()
  if (!ROLES.includes(role)) throw new Error(`Invalid role: ${role}`)
  if (!userId) throw new Error('userId required')

  const sb = createSupabaseAdmin()
  const { error } = await sb.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
  revalidatePath(`/admin/alumnos/${userId}`)
  revalidatePath('/admin/alumnos')
}

export async function grantCourseAccess(userId: string, courseId: string) {
  await requireAdmin()
  if (!userId || !courseId) throw new Error('userId and courseId required')
  const sb = createSupabaseAdmin()
  const stripeSession = `manual_admin_${crypto.randomUUID()}`
  const { error } = await sb.from('course_purchases').insert({
    user_id: userId,
    course_id: courseId,
    stripe_session_id: stripeSession,
    amount_paid: 0,
  })
  // Idempotent on (user_id, course_id) UNIQUE — duplicate is fine
  if (error && error.code !== '23505') throw error
  revalidatePath(`/admin/alumnos/${userId}`)
}

export async function sendNotification(userId: string, title: string, body: string) {
  await requireAdmin()
  const t = title.trim()
  if (!t) throw new Error('Title required')
  if (!userId) throw new Error('userId required')
  const sb = createSupabaseAdmin()
  const { error } = await sb.from('notifications').insert({
    user_id: userId,
    title: t,
    body: body.trim(),
    type: 'admin_message',
  })
  if (error) throw error
  revalidatePath(`/admin/alumnos/${userId}`)
}

export async function deleteUser(userId: string, confirmPhrase: string) {
  const me = await requireAdmin()
  if (confirmPhrase !== 'ELIMINAR') throw new Error('Confirmation phrase required')
  if (userId === me.id) throw new Error('Cannot delete yourself')
  const sb = createSupabaseAdmin()
  const { error } = await sb.auth.admin.deleteUser(userId)
  if (error) throw error
  revalidatePath('/admin/alumnos')
}
```

- [ ] **Step 4: Run tests — pass**

Run: `npx vitest run __tests__/actions/admin-alumnos-actions.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/alumnos/actions.ts __tests__/actions/admin-alumnos-actions.test.ts
git commit -m "feat(admin): add server actions for role/access/notify/delete"
```

### Task 5.5: `StudentActions` UI (modals for the 4 actions)

**Files:**
- Create: `components/admin/StudentDetail/StudentActions.tsx`
- Modify: `components/admin/StudentDetail/StudentSummaryCard.tsx` — render `<StudentActions />` after the social block.
- Modify: `components/admin/StudentDetail/StudentDetail.module.css` — add modal/button styles.

- [ ] **Step 1: Implement `StudentActions.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateUserRole, grantCourseAccess, sendNotification, deleteUser,
} from '@/app/admin/alumnos/actions'
import styles from './StudentDetail.module.css'

type Course = { id: string; title: string }
type Props = { userId: string; currentRole: 'member' | 'premium' | 'admin'; courses: Course[] }

type Modal = 'none' | 'role' | 'grant' | 'notify' | 'delete'

export default function StudentActions({ userId, currentRole, courses }: Props) {
  const [modal, setModal] = useState<Modal>('none')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function close() { setModal('none'); setError(null) }

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try { await fn(); close(); router.refresh() }
      catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    })
  }

  return (
    <section className={styles.summaryBlock}>
      <h3>Acciones</h3>
      <div className={styles.actionsCol}>
        <button className={styles.actionLine} onClick={() => setModal('role')}>Cambiar rol</button>
        <button className={styles.actionLine} onClick={() => setModal('grant')}>+ Conceder acceso a curso</button>
        <button className={styles.actionLine} onClick={() => setModal('notify')}>✉ Enviar notificación</button>
        <button className={`${styles.actionLine} ${styles.actionDanger}`} onClick={() => setModal('delete')}>⚠ Eliminar alumno</button>
      </div>

      {modal !== 'none' && (
        <div className={styles.modalBackdrop} onClick={close}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            {modal === 'role' && (
              <RoleForm
                currentRole={currentRole}
                disabled={isPending}
                onSubmit={(role) => run(() => updateUserRole(userId, role))}
                error={error}
              />
            )}
            {modal === 'grant' && (
              <GrantForm
                courses={courses}
                disabled={isPending}
                onSubmit={(cid) => run(() => grantCourseAccess(userId, cid))}
                error={error}
              />
            )}
            {modal === 'notify' && (
              <NotifyForm
                disabled={isPending}
                onSubmit={(t, b) => run(() => sendNotification(userId, t, b))}
                error={error}
              />
            )}
            {modal === 'delete' && (
              <DeleteForm
                disabled={isPending}
                onSubmit={(p) => run(() => deleteUser(userId, p))}
                error={error}
              />
            )}
            <button className={styles.modalClose} onClick={close} aria-label="Cerrar">✕</button>
          </div>
        </div>
      )}
    </section>
  )
}

function RoleForm({ currentRole, disabled, error, onSubmit }: {
  currentRole: 'member' | 'premium' | 'admin'; disabled: boolean; error: string | null
  onSubmit: (r: 'member' | 'premium' | 'admin') => void
}) {
  const [r, setR] = useState(currentRole)
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(r) }}>
      <h3>Cambiar rol</h3>
      <select value={r} onChange={e => setR(e.target.value as never)} disabled={disabled} className={styles.input}>
        <option value="member">member</option>
        <option value="premium">premium</option>
        <option value="admin">admin</option>
      </select>
      {error && <p className={styles.errorMsg}>{error}</p>}
      <button type="submit" disabled={disabled} className={styles.btnPrimary}>Guardar</button>
    </form>
  )
}

function GrantForm({ courses, disabled, error, onSubmit }: {
  courses: Course[]; disabled: boolean; error: string | null; onSubmit: (id: string) => void
}) {
  const [cid, setCid] = useState(courses[0]?.id ?? '')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (cid) onSubmit(cid) }}>
      <h3>Conceder acceso a curso</h3>
      <select value={cid} onChange={e => setCid(e.target.value)} disabled={disabled} className={styles.input}>
        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      {error && <p className={styles.errorMsg}>{error}</p>}
      <button type="submit" disabled={disabled || !cid} className={styles.btnPrimary}>Conceder</button>
    </form>
  )
}

function NotifyForm({ disabled, error, onSubmit }: {
  disabled: boolean; error: string | null; onSubmit: (title: string, body: string) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(title, body) }}>
      <h3>Enviar notificación</h3>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título" disabled={disabled} className={styles.input} />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Mensaje" rows={4} disabled={disabled} className={styles.input} />
      {error && <p className={styles.errorMsg}>{error}</p>}
      <button type="submit" disabled={disabled || !title.trim()} className={styles.btnPrimary}>Enviar</button>
    </form>
  )
}

function DeleteForm({ disabled, error, onSubmit }: {
  disabled: boolean; error: string | null; onSubmit: (phrase: string) => void
}) {
  const [phrase, setPhrase] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(phrase) }}>
      <h3>Eliminar alumno</h3>
      <p>Esta acción es <strong>irreversible</strong>. Escribe <code>ELIMINAR</code> para confirmar.</p>
      <input value={phrase} onChange={e => setPhrase(e.target.value)} disabled={disabled} className={styles.input} />
      {error && <p className={styles.errorMsg}>{error}</p>}
      <button type="submit" disabled={disabled || phrase !== 'ELIMINAR'} className={styles.btnDanger}>
        Eliminar definitivamente
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Pass courses list to summary card**

Modify `getStudentDetail()` to also return the full list of courses (id+title) so we can populate the grant-access modal — OR (simpler) fetch courses in the page. We add it to the page:

In `app/admin/alumnos/[id]/page.tsx`, fetch courses alongside detail and pass them to the summary card:

```typescript
import { createSupabaseAdmin } from '@/utils/supabase/admin'
// ...

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = createSupabaseAdmin()
  const [data, coursesRes] = await Promise.all([
    getStudentDetail(id),
    sb.from('courses').select('id, title').eq('is_published', true).order('title'),
  ])
  if (!data) notFound()
  const courses = (coursesRes.data ?? []).map(c => ({ id: c.id as string, title: c.title as string }))

  return (
    <div className={styles.page}>
      <StudentSummaryCard data={data} courses={courses} />
      {/* ...rest unchanged */}
```

- [ ] **Step 3: Modify `StudentSummaryCard.tsx` to accept courses and render `StudentActions`**

Add the import at top:
```typescript
import StudentActions from './StudentActions'
```

Update the prop type:
```typescript
export default function StudentSummaryCard({
  data, courses,
}: { data: StudentDetail; courses: { id: string; title: string }[] }) {
```

After the `socials` section, add:
```tsx
<StudentActions userId={data.profile.id} currentRole={data.profile.role} courses={courses} />
```

- [ ] **Step 4: Append modal/button styles to `StudentDetail.module.css`**

```css
.actionsCol { display: flex; flex-direction: column; gap: 0.3rem; }
.actionLine {
  text-align: left; padding: 0.45rem 0.6rem;
  background: rgba(var(--primary-rgb), 0.06);
  border: 1px solid rgba(var(--primary-rgb), 0.14);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-main);
}
.actionLine:hover { background: rgba(var(--primary-rgb), 0.12); }
.actionDanger { color: rgba(180, 60, 60, 1); border-color: rgba(180, 60, 60, 0.3); background: rgba(180, 60, 60, 0.06); }
.actionDanger:hover { background: rgba(180, 60, 60, 0.12); }

.modalBackdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 50;
}
.modal {
  background: var(--background);
  border: 1px solid rgba(var(--primary-rgb), 0.18);
  border-radius: 10px;
  padding: 1.5rem;
  width: min(420px, calc(100vw - 2rem));
  position: relative;
  display: flex; flex-direction: column; gap: 0.6rem;
}
.modal h3 { margin: 0 0 0.25rem; font-size: 1rem; }

.modalClose {
  position: absolute; top: 8px; right: 8px;
  background: transparent; border: 0; cursor: pointer;
  font-size: 1.1rem; line-height: 1;
  color: rgba(var(--text-rgb, 30, 30, 30), 0.6);
}

.input {
  padding: 0.5rem 0.7rem;
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: 6px;
  background: var(--background);
  color: var(--text-main);
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
}

.btnPrimary {
  padding: 0.55rem 1rem;
  background: rgba(var(--primary-rgb), 1);
  color: white;
  border: 0; border-radius: 6px;
  cursor: pointer; font-size: 0.9rem;
  align-self: flex-start;
}
.btnPrimary:disabled { opacity: 0.5; cursor: not-allowed; }

.btnDanger {
  padding: 0.55rem 1rem;
  background: rgba(180, 60, 60, 1); color: white;
  border: 0; border-radius: 6px;
  cursor: pointer; font-size: 0.9rem;
  align-self: flex-start;
}
.btnDanger:disabled { opacity: 0.5; cursor: not-allowed; }

.errorMsg { color: rgba(180, 60, 60, 1); font-size: 0.85rem; margin: 0; }

.summaryBlockHeading { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; color: rgba(var(--text-rgb, 30, 30, 30), 0.55); margin: 0.5rem 0 0.4rem; font-weight: 500; }
```

- [ ] **Step 5: Smoke test**

Run: `npm run dev`. On a student detail:
- Click "Cambiar rol" → modal opens, change & save → role updates.
- Click "Conceder acceso" → choose a course → row added to "Por compra" tab.
- Click "Enviar notificación" → fill & send → check `notifications` table in Supabase.
- Click "Eliminar alumno" → confirm with `ELIMINAR` → user disappears from list. **Test on a throwaway account.**

- [ ] **Step 6: Commit**

```bash
git add components/admin/StudentDetail/StudentActions.tsx components/admin/StudentDetail/StudentSummaryCard.tsx components/admin/StudentDetail/StudentDetail.module.css app/admin/alumnos/[id]/page.tsx
git commit -m "feat(admin): add admin actions UI (role/grant/notify/delete) on student detail"
```

---

## Phase 6 — Statistics page `/admin/estadisticas` (6 charts)

### Task 6.1: Stats fetchers in `queries.ts`

**Files:**
- Modify: `utils/admin/queries.ts`

- [ ] **Step 1: Append the 6 fetchers**

```typescript
export type Range = 30 | 90 | 365 | 'all'

function rangeStartIso(range: Range): string | null {
  if (range === 'all') return null
  const d = new Date(Date.now() - range * 86_400_000)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export type IncomeMonthRow = { month: string; subscriptions: number; purchases: number }
export type CountMonthRow = { month: string; value: number }
export type ActiveSubsDay = { date: string; count: number }
export type TopCourseRow = { course: string; purchases: number; learners: number }
export type PlanSlice = { plan: string; count: number }
export type EngagementWeek = { week: string; completions: number }

export async function getStatsIncomeByMonth(range: Range): Promise<IncomeMonthRow[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { centsToEur, groupByMonth } = await import('@/utils/admin/metrics')
  const { PLAN_PRICES_EUR } = await import('@/utils/admin/plan-prices')
  const since = rangeStartIso(range)

  let pq = sb.from('course_purchases').select('amount_paid, created_at')
  let sq = sb.from('subscriptions').select('plan_type, created_at')
  if (since) { pq = pq.gte('created_at', since); sq = sq.gte('created_at', since) }
  const [purchases, subs] = await Promise.all([pq, sq])

  const purchaseMonths = groupByMonth(
    (purchases.data ?? []) as { amount_paid: number | null; created_at: string }[],
    r => r.created_at,
    r => centsToEur(r.amount_paid),
  )
  const subMonths = groupByMonth(
    (subs.data ?? []) as { plan_type: keyof typeof PLAN_PRICES_EUR | null; created_at: string }[],
    r => r.created_at,
    r => (r.plan_type ? PLAN_PRICES_EUR[r.plan_type] ?? 0 : 0),
  )
  const months = new Set([...purchaseMonths.map(m => m.month), ...subMonths.map(m => m.month)])
  const pmap = new Map(purchaseMonths.map(m => [m.month, m.value]))
  const smap = new Map(subMonths.map(m => [m.month, m.value]))
  return [...months].sort().map(m => ({
    month: m,
    purchases: pmap.get(m) ?? 0,
    subscriptions: smap.get(m) ?? 0,
  }))
}

export async function getStatsSignupsByMonth(range: Range): Promise<CountMonthRow[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { groupByMonth } = await import('@/utils/admin/metrics')
  const since = rangeStartIso(range)

  let q = sb.from('profiles').select('updated_at')
  if (since) q = q.gte('updated_at', since)
  const { data } = await q

  return groupByMonth(
    (data ?? []) as { updated_at: string }[],
    r => r.updated_at,
    () => 1,
  )
}

export async function getStatsActiveSubsTimeseries(range: Range): Promise<ActiveSubsDay[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()

  const { data } = await sb
    .from('subscriptions')
    .select('current_period_start, current_period_end')

  const subs = (data ?? []) as { current_period_start: string | null; current_period_end: string | null }[]

  const days = range === 'all' ? 365 : range
  const out: ActiveSubsDay[] = []
  const start = new Date(Date.now() - days * 86_400_000)
  start.setUTCHours(0, 0, 0, 0)

  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000)
    const iso = d.toISOString()
    const count = subs.filter(s =>
      s.current_period_start && s.current_period_end &&
      s.current_period_start <= iso && s.current_period_end >= iso
    ).length
    out.push({ date: iso.slice(0, 10), count })
  }
  return out
}

export async function getStatsTopCourses(): Promise<TopCourseRow[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()

  const [purchases, progress, courses] = await Promise.all([
    sb.from('course_purchases').select('course_id'),
    sb.from('lesson_progress').select('user_id, lessons!inner(course_id)').eq('is_completed', true),
    sb.from('courses').select('id, title'),
  ])

  type LP = { user_id: string; lessons: { course_id: string } | { course_id: string }[] | null }
  const purchaseCount = new Map<string, number>()
  for (const p of (purchases.data ?? []) as { course_id: string }[]) {
    purchaseCount.set(p.course_id, (purchaseCount.get(p.course_id) ?? 0) + 1)
  }
  const learners = new Map<string, Set<string>>()
  for (const r of (progress.data ?? []) as LP[]) {
    const lesson = Array.isArray(r.lessons) ? r.lessons[0] : r.lessons
    const cid = lesson?.course_id; if (!cid) continue
    if (!learners.has(cid)) learners.set(cid, new Set())
    learners.get(cid)!.add(r.user_id)
  }
  const titleById = new Map((courses.data ?? []).map(c => [c.id as string, c.title as string]))

  const ids = new Set([...purchaseCount.keys(), ...learners.keys()])
  return [...ids]
    .map(id => ({
      course: titleById.get(id) ?? '—',
      purchases: purchaseCount.get(id) ?? 0,
      learners: (learners.get(id)?.size) ?? 0,
    }))
    .sort((a, b) => (b.purchases + b.learners) - (a.purchases + a.learners))
    .slice(0, 8)
}

export async function getStatsPlanDistribution(): Promise<PlanSlice[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { data } = await sb
    .from('subscriptions')
    .select('plan_type')
    .in('status', ['active', 'trialing'])

  const counts = new Map<string, number>()
  for (const r of (data ?? []) as { plan_type: string | null }[]) {
    const p = r.plan_type ?? 'desconocido'
    counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  return [...counts.entries()].map(([plan, count]) => ({ plan, count }))
}

export async function getStatsEngagement(range: Range): Promise<EngagementWeek[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const since = rangeStartIso(range)
  let q = sb.from('lesson_progress').select('updated_at').eq('is_completed', true)
  if (since) q = q.gte('updated_at', since)
  const { data } = await q

  const buckets = new Map<string, number>()
  for (const r of (data ?? []) as { updated_at: string }[]) {
    const d = new Date(r.updated_at)
    if (Number.isNaN(d.valueOf())) continue
    const day = d.getUTCDay() // 0..6
    const monday = new Date(d)
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7))
    monday.setUTCHours(0, 0, 0, 0)
    const key = monday.toISOString().slice(0, 10)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.entries()]
    .map(([week, completions]) => ({ week, completions }))
    .sort((a, b) => a.week.localeCompare(b.week))
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add utils/admin/queries.ts
git commit -m "feat(admin): add 6 stats fetchers"
```

### Task 6.2: `ChartShell` shared wrapper

**Files:**
- Create: `components/admin/charts/ChartShell.tsx`
- Create: `components/admin/charts/charts.module.css`

- [ ] **Step 1: Implement ChartShell**

```typescript
import type { ReactNode } from 'react'
import styles from './charts.module.css'

export default function ChartShell({
  title, sub, children, isEmpty,
}: {
  title: string; sub?: string; children: ReactNode; isEmpty?: boolean
}) {
  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {sub && <p className={styles.sub}>{sub}</p>}
      </header>
      <div className={styles.chartWrap}>
        {isEmpty
          ? <p className={styles.empty}>Sin datos en este rango.</p>
          : children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CSS**

```css
.card {
  background: rgba(var(--primary-rgb), 0.03);
  border: 1px solid rgba(var(--primary-rgb), 0.1);
  border-radius: 10px;
  padding: 1rem 1.1rem;
  display: flex; flex-direction: column; gap: 0.5rem;
  min-width: 0;
}

.header { display: flex; flex-direction: column; gap: 0.15rem; }
.title { font-size: 0.95rem; font-weight: 600; margin: 0; }
.sub { margin: 0; font-size: 0.78rem; color: rgba(var(--text-rgb, 30, 30, 30), 0.65); }

.chartWrap { width: 100%; }
.empty { padding: 2.5rem 1rem; text-align: center; color: rgba(var(--text-rgb, 30, 30, 30), 0.5); font-size: 0.85rem; }
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/charts
git commit -m "feat(admin): add ChartShell wrapper for stats charts"
```

### Task 6.3: 6 chart components

**Files:**
- Create: `components/admin/charts/IncomeByMonthChart.tsx`
- Create: `components/admin/charts/StudentSignupsChart.tsx`
- Create: `components/admin/charts/ActiveSubsChart.tsx`
- Create: `components/admin/charts/TopCoursesChart.tsx`
- Create: `components/admin/charts/PlanDistributionChart.tsx`
- Create: `components/admin/charts/EngagementChart.tsx`

- [ ] **Step 1: `IncomeByMonthChart.tsx`**

```typescript
'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import ChartShell from './ChartShell'
import type { IncomeMonthRow } from '@/utils/admin/queries'

export default function IncomeByMonthChart({ data }: { data: IncomeMonthRow[] }) {
  return (
    <ChartShell title="Ingresos por mes" sub="Suscripciones + compras de cursos" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={(v: number) => `€${Number(v).toFixed(0)}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="subscriptions" stackId="a" fill="rgba(var(--primary-rgb), 0.55)" name="Suscripciones" />
          <Bar dataKey="purchases" stackId="a" fill="rgba(var(--primary-rgb), 1)" name="Compras" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
```

- [ ] **Step 2: `StudentSignupsChart.tsx`**

```typescript
'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import ChartShell from './ChartShell'
import type { CountMonthRow } from '@/utils/admin/queries'

export default function StudentSignupsChart({ data }: { data: CountMonthRow[] }) {
  return (
    <ChartShell title="Altas de alumnos" sub="Por mes" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="rgba(var(--primary-rgb), 0.85)" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
```

- [ ] **Step 3: `ActiveSubsChart.tsx`**

```typescript
'use client'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import ChartShell from './ChartShell'
import type { ActiveSubsDay } from '@/utils/admin/queries'

export default function ActiveSubsChart({ data }: { data: ActiveSubsDay[] }) {
  return (
    <ChartShell title="Suscripciones activas en el tiempo" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="activeSubsG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(var(--primary-rgb), 0.5)" />
              <stop offset="100%" stopColor="rgba(var(--primary-rgb), 0.05)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={20} />
          <YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
          <Tooltip />
          <Area type="monotone" dataKey="count" stroke="rgba(var(--primary-rgb), 1)" fill="url(#activeSubsG)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
```

- [ ] **Step 4: `TopCoursesChart.tsx`**

```typescript
'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import ChartShell from './ChartShell'
import type { TopCourseRow } from '@/utils/admin/queries'

export default function TopCoursesChart({ data }: { data: TopCourseRow[] }) {
  return (
    <ChartShell title="Top cursos" sub="Compras y alumnos activos" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="course" tick={{ fontSize: 11 }} width={140} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="purchases" fill="rgba(var(--primary-rgb), 1)" name="Compras" />
          <Bar dataKey="learners" fill="rgba(var(--primary-rgb), 0.4)" name="Alumnos activos" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
```

- [ ] **Step 5: `PlanDistributionChart.tsx`**

```typescript
'use client'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import ChartShell from './ChartShell'
import type { PlanSlice } from '@/utils/admin/queries'

const COLORS = [
  'rgba(var(--primary-rgb), 1)',
  'rgba(var(--primary-rgb), 0.6)',
  'rgba(var(--primary-rgb), 0.35)',
  'rgba(var(--primary-rgb), 0.18)',
]

const PLAN_LABELS: Record<string, string> = { '1month': 'Mensual', '6months': '6 meses', '1year': 'Anual' }

export default function PlanDistributionChart({ data }: { data: PlanSlice[] }) {
  const formatted = data.map(d => ({ name: PLAN_LABELS[d.plan] ?? d.plan, value: d.count }))
  return (
    <ChartShell title="Distribución de planes" sub="Suscripciones activas" isEmpty={formatted.length === 0}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={formatted} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
            {formatted.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
```

- [ ] **Step 6: `EngagementChart.tsx`**

```typescript
'use client'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import ChartShell from './ChartShell'
import type { EngagementWeek } from '@/utils/admin/queries'

export default function EngagementChart({ data }: { data: EngagementWeek[] }) {
  return (
    <ChartShell title="Engagement" sub="Lecciones completadas por semana" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={20} />
          <YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="completions" stroke="rgba(var(--primary-rgb), 1)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add components/admin/charts
git commit -m "feat(admin): add 6 chart components for stats page"
```

### Task 6.4: Stats page with range filter

**Files:**
- Create: `app/admin/estadisticas/page.tsx`
- Create: `app/admin/estadisticas/estadisticas.module.css`
- Create: `components/admin/charts/RangePicker.tsx`

- [ ] **Step 1: Implement `RangePicker.tsx` (client)**

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import styles from './charts.module.css'

const RANGES: { key: '30' | '90' | '365' | 'all'; label: string }[] = [
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: '365', label: '1 año' },
  { key: 'all', label: 'Todo' },
]

export default function RangePicker({ value }: { value: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  function setRange(v: string) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    if (v === '90') sp.delete('range')
    else sp.set('range', v)
    startTransition(() => router.replace(`?${sp.toString()}`))
  }

  return (
    <div role="tablist" className={styles.tabs}>
      {RANGES.map(r => (
        <button
          key={r.key}
          role="tab"
          aria-selected={value === r.key}
          className={`${styles.tab} ${value === r.key ? styles.tabActive : ''}`}
          onClick={() => setRange(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Append tab styles to `charts.module.css`**

```css
.tabs { display: inline-flex; border: 1px solid rgba(var(--primary-rgb), 0.18); border-radius: 6px; padding: 2px; }
.tab {
  background: transparent; border: 0; cursor: pointer;
  padding: 0.3rem 0.7rem; font-size: 0.8rem;
  color: rgba(var(--text-rgb, 30, 30, 30), 0.7);
  border-radius: 4px;
}
.tabActive { background: rgba(var(--primary-rgb), 0.15); color: rgba(var(--primary-rgb), 1); font-weight: 600; }
```

- [ ] **Step 3: Implement stats page**

```typescript
import RangePicker from '@/components/admin/charts/RangePicker'
import IncomeByMonthChart from '@/components/admin/charts/IncomeByMonthChart'
import StudentSignupsChart from '@/components/admin/charts/StudentSignupsChart'
import ActiveSubsChart from '@/components/admin/charts/ActiveSubsChart'
import TopCoursesChart from '@/components/admin/charts/TopCoursesChart'
import PlanDistributionChart from '@/components/admin/charts/PlanDistributionChart'
import EngagementChart from '@/components/admin/charts/EngagementChart'
import {
  getStatsIncomeByMonth, getStatsSignupsByMonth, getStatsActiveSubsTimeseries,
  getStatsTopCourses, getStatsPlanDistribution, getStatsEngagement,
  type Range,
} from '@/utils/admin/queries'
import styles from './estadisticas.module.css'

export const dynamic = 'force-dynamic'

function parseRange(raw: string | undefined): Range {
  if (raw === '30') return 30
  if (raw === '365') return 365
  if (raw === 'all') return 'all'
  return 90
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const sp = await searchParams
  const range = parseRange(sp.range)
  const rangeKey = sp.range && ['30', '90', '365', 'all'].includes(sp.range) ? sp.range : '90'

  const [income, signups, activeSubs, topCourses, plans, engagement] = await Promise.all([
    getStatsIncomeByMonth(range),
    getStatsSignupsByMonth(range),
    getStatsActiveSubsTimeseries(range),
    getStatsTopCourses(),
    getStatsPlanDistribution(),
    getStatsEngagement(range),
  ])

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Estadísticas</h1>
        <RangePicker value={rangeKey} />
      </header>

      <div className={styles.grid}>
        <div className={styles.full}><IncomeByMonthChart data={income} /></div>
        <div className={styles.full}><StudentSignupsChart data={signups} /></div>
        <div className={styles.full}><ActiveSubsChart data={activeSubs} /></div>
        <div className={styles.half}><TopCoursesChart data={topCourses} /></div>
        <div className={styles.half}><PlanDistributionChart data={plans} /></div>
        <div className={styles.full}><EngagementChart data={engagement} /></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: CSS**

```css
.container { display: flex; flex-direction: column; gap: 1rem; }

.header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; }
.title { font-size: clamp(1.4rem, 2.5vw, 1.8rem); margin: 0; font-weight: 600; }

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.full { grid-column: span 2 / span 2; }
.half { grid-column: span 1 / span 1; }

@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
  .full, .half { grid-column: span 1; }
}
```

- [ ] **Step 5: Smoke test**

Run: `npm run dev`. Visit `/admin/estadisticas`. Confirm:
- 6 charts render.
- Range picker works (URL changes, charts re-render).
- Empty states show "Sin datos en este rango." when no data.

- [ ] **Step 6: Commit**

```bash
git add app/admin/estadisticas components/admin/charts/RangePicker.tsx
git commit -m "feat(admin): add /admin/estadisticas page with 6 charts and range filter"
```

---

## Phase 7 — Secondary sections: entregas, cursos, comunidad

### Task 7.1: `/admin/entregas` — pending submissions queue

**Files:**
- Create: `app/admin/entregas/page.tsx`
- Modify: `utils/admin/queries.ts`

- [ ] **Step 1: Append `listSubmissions()` to `queries.ts`**

```typescript
export type SubmissionRow = {
  id: string
  user_id: string
  user_name: string | null
  course_id: string
  course_title: string
  lesson_id: string
  lesson_title: string
  assignment_title: string
  status: 'pending' | 'reviewed'
  created_at: string
}

export async function listSubmissions(status: 'pending' | 'reviewed'): Promise<SubmissionRow[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()

  const { data } = await sb
    .from('submissions')
    .select(`
      id, user_id, status, created_at,
      profiles!inner(full_name),
      assignments!inner(
        title, lesson_id, course_id,
        lessons(id, title),
        courses(id, title)
      )
    `)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100)

  type Row = {
    id: string; user_id: string; status: string; created_at: string
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
    assignments: {
      title: string; lesson_id: string; course_id: string
      lessons: { id: string; title: string } | { id: string; title: string }[] | null
      courses: { id: string; title: string } | { id: string; title: string }[] | null
    } | null
  }
  const pickFirst = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  return ((data ?? []) as Row[]).map(r => {
    const profile = pickFirst(r.profiles)
    const a = r.assignments
    const lesson = pickFirst(a?.lessons)
    const course = pickFirst(a?.courses)
    return {
      id: r.id,
      user_id: r.user_id,
      user_name: profile?.full_name ?? null,
      course_id: course?.id ?? a?.course_id ?? '',
      course_title: course?.title ?? '—',
      lesson_id: lesson?.id ?? a?.lesson_id ?? '',
      lesson_title: lesson?.title ?? '—',
      assignment_title: a?.title ?? '—',
      status: (r.status as 'pending' | 'reviewed'),
      created_at: r.created_at,
    }
  })
}
```

- [ ] **Step 2: Implement `app/admin/entregas/page.tsx`**

```typescript
import Link from 'next/link'
import { listSubmissions } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from '@/app/admin/alumnos/alumnos.module.css'

export const dynamic = 'force-dynamic'

export default async function EntregasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sp = await searchParams
  const tab = sp.tab === 'reviewed' ? 'reviewed' : 'pending'
  const rows = await listSubmissions(tab)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Entregas <span className={styles.count}>({rows.length})</span></h1>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <Link
          href="?tab=pending"
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 6,
            background: tab === 'pending' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
            color: tab === 'pending' ? 'rgba(var(--primary-rgb), 1)' : 'inherit',
            textDecoration: 'none',
            fontSize: '0.88rem',
            fontWeight: tab === 'pending' ? 600 : 400,
          }}
        >Pendientes</Link>
        <Link
          href="?tab=reviewed"
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 6,
            background: tab === 'reviewed' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
            color: tab === 'reviewed' ? 'rgba(var(--primary-rgb), 1)' : 'inherit',
            textDecoration: 'none',
            fontSize: '0.88rem',
            fontWeight: tab === 'reviewed' ? 600 : 400,
          }}
        >Revisadas</Link>
      </nav>

      {rows.length === 0 ? (
        <p style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.55)', textAlign: 'center', padding: '2rem' }}>
          {tab === 'pending' ? 'No hay entregas pendientes.' : 'No hay entregas revisadas.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map(r => (
            <li key={r.id} style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1.4fr 0.8fr auto',
              gap: '1rem',
              padding: '0.7rem 0.85rem',
              border: '1px solid rgba(var(--primary-rgb), 0.08)',
              borderRadius: 6,
              alignItems: 'center',
            }}>
              <div>
                <Link href={`/admin/alumnos/${r.user_id}`} style={{ color: 'var(--text-main)' }}>
                  {r.user_name ?? 'Sin nombre'}
                </Link>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.7)' }}>
                {r.course_title} · {r.lesson_title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>
                {formatRelative(r.created_at)}
              </div>
              <Link
                href={`/courses/${r.course_id}/${r.lesson_id}/submissions`}
                style={{ color: 'rgba(var(--primary-rgb), 1)', fontSize: '0.85rem' }}
              >
                Corregir →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

> **Note:** Inline styles used here (one-page route, no need to introduce a new CSS module). If you prefer, lift to a module — both fine.

- [ ] **Step 3: Smoke test**

Run: `npm run dev`. Visit `/admin/entregas`. Toggle tabs. Click "Corregir" — opens existing submissions page.

- [ ] **Step 4: Commit**

```bash
git add app/admin/entregas utils/admin/queries.ts
git commit -m "feat(admin): add /admin/entregas pending/reviewed queue"
```

### Task 7.2: `/admin/cursos` — courses overview

**Files:**
- Create: `app/admin/cursos/page.tsx`
- Modify: `utils/admin/queries.ts`

- [ ] **Step 1: Append `listCoursesWithStats()` to `queries.ts`**

```typescript
export type CourseStatsRow = {
  id: string
  title: string
  image_url: string | null
  course_type: 'membership' | 'complete'
  is_published: boolean
  lessonsCount: number
  studentsWithAccess: number
  avgCompletion: number
  revenueEur: number
}

export async function listCoursesWithStats(): Promise<CourseStatsRow[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { centsToEur } = await import('@/utils/admin/metrics')

  const [coursesRes, lessonsRes, purchasesRes, progressRes] = await Promise.all([
    sb.from('courses').select('id, title, image_url, course_type, is_published'),
    sb.from('lessons').select('id, course_id'),
    sb.from('course_purchases').select('course_id, user_id, amount_paid'),
    sb.from('lesson_progress').select('lesson_id, user_id, is_completed, lessons!inner(course_id)'),
  ])

  type Lesson = { id: string; course_id: string }
  type Purchase = { course_id: string; user_id: string; amount_paid: number | null }
  type Progress = {
    lesson_id: string; user_id: string; is_completed: boolean | null
    lessons: { course_id: string } | { course_id: string }[] | null
  }

  const lessonsByCourse = new Map<string, number>()
  for (const l of (lessonsRes.data ?? []) as Lesson[]) {
    lessonsByCourse.set(l.course_id, (lessonsByCourse.get(l.course_id) ?? 0) + 1)
  }

  const accessByCourse = new Map<string, Set<string>>()
  const revenueByCourse = new Map<string, number>()
  for (const p of (purchasesRes.data ?? []) as Purchase[]) {
    if (!accessByCourse.has(p.course_id)) accessByCourse.set(p.course_id, new Set())
    accessByCourse.get(p.course_id)!.add(p.user_id)
    revenueByCourse.set(p.course_id, (revenueByCourse.get(p.course_id) ?? 0) + centsToEur(p.amount_paid))
  }

  const completionsByCourse = new Map<string, { total: number; completed: number }>()
  for (const r of (progressRes.data ?? []) as Progress[]) {
    const lesson = Array.isArray(r.lessons) ? r.lessons[0] : r.lessons
    const cid = lesson?.course_id; if (!cid) continue
    const bucket = completionsByCourse.get(cid) ?? { total: 0, completed: 0 }
    bucket.total += 1
    if (r.is_completed) bucket.completed += 1
    completionsByCourse.set(cid, bucket)
  }

  return ((coursesRes.data ?? []) as Array<{
    id: string; title: string; image_url: string | null
    course_type: 'membership' | 'complete'; is_published: boolean
  }>).map(c => {
    const completion = completionsByCourse.get(c.id)
    const pct = completion && completion.total > 0
      ? Math.round((completion.completed / completion.total) * 100)
      : 0
    return {
      id: c.id, title: c.title, image_url: c.image_url,
      course_type: c.course_type, is_published: c.is_published,
      lessonsCount: lessonsByCourse.get(c.id) ?? 0,
      studentsWithAccess: accessByCourse.get(c.id)?.size ?? 0,
      avgCompletion: pct,
      revenueEur: revenueByCourse.get(c.id) ?? 0,
    }
  })
}
```

- [ ] **Step 2: Implement `app/admin/cursos/page.tsx`**

```typescript
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Pencil, BookOpen } from 'lucide-react'
import { listCoursesWithStats } from '@/utils/admin/queries'

export const dynamic = 'force-dynamic'

export default async function CursosAdminPage() {
  const courses = await listCoursesWithStats()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', fontWeight: 600 }}>
          Cursos <span style={{ fontWeight: 400, color: 'rgba(var(--text-rgb, 30, 30, 30), 0.55)', fontSize: '0.85em' }}>({courses.length})</span>
        </h1>
        <Link href="/courses/create" style={{
          padding: '0.55rem 1rem',
          background: 'rgba(var(--primary-rgb), 1)',
          color: 'white',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: '0.9rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
          <Plus size={14} aria-hidden /> Crear curso
        </Link>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {courses.map(c => (
          <article key={c.id} style={{
            background: 'rgba(var(--primary-rgb), 0.03)',
            border: '1px solid rgba(var(--primary-rgb), 0.1)',
            borderRadius: 10,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ position: 'relative', aspectRatio: '16 / 9', background: 'rgba(var(--primary-rgb), 0.08)' }}>
              {c.image_url
                ? <Image src={c.image_url} alt="" fill style={{ objectFit: 'cover' }} sizes="280px" />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(var(--primary-rgb), 1)' }}><BookOpen size={28} /></div>}
              {!c.is_published && (
                <span style={{
                  position: 'absolute', top: 8, left: 8,
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 4,
                }}>Borrador</span>
              )}
              <span style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(var(--primary-rgb), 0.85)',
                color: 'white', fontSize: '0.7rem',
                padding: '0.15rem 0.5rem', borderRadius: 4,
              }}>{c.course_type === 'membership' ? 'Membresía' : 'Completo'}</span>
            </div>
            <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{c.title}</h2>
              <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 0.75rem', margin: 0, fontSize: '0.8rem' }}>
                <dt style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>Lecciones</dt>
                <dd style={{ margin: 0 }}>{c.lessonsCount}</dd>
                <dt style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>Alumnos</dt>
                <dd style={{ margin: 0 }}>{c.studentsWithAccess}</dd>
                <dt style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>Progreso</dt>
                <dd style={{ margin: 0 }}>{c.avgCompletion}%</dd>
                <dt style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>Ingresos</dt>
                <dd style={{ margin: 0 }}>€{c.revenueEur.toFixed(0)}</dd>
              </dl>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                <Link href={`/courses/${c.id}/edit`} style={{
                  flex: 1, padding: '0.45rem 0.6rem',
                  border: '1px solid rgba(var(--primary-rgb), 0.2)',
                  borderRadius: 6, color: 'var(--text-main)',
                  textDecoration: 'none', fontSize: '0.82rem',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                }}>
                  <Pencil size={12} aria-hidden /> Editar
                </Link>
                <Link href={`/courses/${c.id}/add-lesson`} style={{
                  flex: 1, padding: '0.45rem 0.6rem',
                  background: 'rgba(var(--primary-rgb), 0.08)',
                  border: '1px solid rgba(var(--primary-rgb), 0.2)',
                  borderRadius: 6, color: 'var(--text-main)',
                  textDecoration: 'none', fontSize: '0.82rem',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                }}>
                  <Plus size={12} aria-hidden /> Lección
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`. Visit `/admin/cursos`. Cards render with stats. Buttons take you to existing edit/add-lesson routes.

- [ ] **Step 4: Commit**

```bash
git add app/admin/cursos utils/admin/queries.ts
git commit -m "feat(admin): add /admin/cursos overview with per-course stats"
```

### Task 7.3: `/admin/comunidad` — moderation

**Files:**
- Create: `app/admin/comunidad/page.tsx`
- Create: `app/admin/comunidad/actions.ts`
- Modify: `utils/admin/queries.ts`

- [ ] **Step 1: Append `listRecentPosts()` and `listRecentComments()` to `queries.ts`**

```typescript
export type ModPostRow = {
  id: string; user_id: string; user_name: string | null
  content: string; created_at: string
  likeCount: number; commentCount: number
}
export type ModCommentRow = {
  id: string; user_id: string; user_name: string | null
  post_id: string; content: string; created_at: string
}

export async function listRecentPosts(limit = 50): Promise<ModPostRow[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { data } = await sb
    .from('posts')
    .select('id, user_id, content, created_at, profiles!inner(full_name), post_likes(count), comments(count)')
    .order('created_at', { ascending: false })
    .limit(limit)

  type Row = {
    id: string; user_id: string; content: string; created_at: string
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
    post_likes: { count: number }[] | null
    comments: { count: number }[] | null
  }
  const pickFirst = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  return ((data ?? []) as Row[]).map(r => ({
    id: r.id, user_id: r.user_id, content: r.content,
    user_name: pickFirst(r.profiles)?.full_name ?? null,
    created_at: r.created_at,
    likeCount: r.post_likes?.[0]?.count ?? 0,
    commentCount: r.comments?.[0]?.count ?? 0,
  }))
}

export async function listRecentComments(limit = 50): Promise<ModCommentRow[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { data } = await sb
    .from('comments')
    .select('id, user_id, post_id, content, created_at, profiles!inner(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  type Row = {
    id: string; user_id: string; post_id: string; content: string; created_at: string
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
  }
  const pickFirst = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  return ((data ?? []) as Row[]).map(r => ({
    id: r.id, user_id: r.user_id, post_id: r.post_id, content: r.content,
    user_name: pickFirst(r.profiles)?.full_name ?? null,
    created_at: r.created_at,
  }))
}
```

> **Note on table names:** verify the comments table is `comments` (not `community_comments` or similar). Check `supabase/community_setup.sql` and `supabase/comments_setup.sql` — if they differ, two tables exist and you must pick the one used by the live app. Use `grep -n "from('comments')" -- *.tsx` to see which one the codebase already queries.

- [ ] **Step 2: Implement `app/admin/comunidad/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/utils/admin/guard'
import { createSupabaseAdmin } from '@/utils/supabase/admin'

export async function deletePost(postId: string) {
  await requireAdmin()
  if (!postId) throw new Error('postId required')
  const sb = createSupabaseAdmin()
  const { error } = await sb.from('posts').delete().eq('id', postId)
  if (error) throw error
  revalidatePath('/admin/comunidad')
}

export async function deleteComment(commentId: string) {
  await requireAdmin()
  if (!commentId) throw new Error('commentId required')
  const sb = createSupabaseAdmin()
  const { error } = await sb.from('comments').delete().eq('id', commentId)
  if (error) throw error
  revalidatePath('/admin/comunidad')
}
```

- [ ] **Step 3: Implement `app/admin/comunidad/page.tsx`**

```typescript
import Link from 'next/link'
import { listRecentPosts, listRecentComments } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import DeletePostBtn from './DeletePostBtn'
import DeleteCommentBtn from './DeleteCommentBtn'

export const dynamic = 'force-dynamic'

export default async function ComunidadAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sp = await searchParams
  const tab = sp.tab === 'comments' ? 'comments' : 'posts'
  const [posts, comments] = await Promise.all([
    listRecentPosts(),
    listRecentComments(),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', fontWeight: 600 }}>Comunidad</h1>

      <nav style={{ display: 'flex', gap: '0.5rem' }}>
        <Link
          href="?tab=posts"
          style={{
            padding: '0.4rem 0.85rem', borderRadius: 6, textDecoration: 'none',
            background: tab === 'posts' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
            color: tab === 'posts' ? 'rgba(var(--primary-rgb), 1)' : 'inherit',
            fontSize: '0.88rem', fontWeight: tab === 'posts' ? 600 : 400,
          }}
        >Posts ({posts.length})</Link>
        <Link
          href="?tab=comments"
          style={{
            padding: '0.4rem 0.85rem', borderRadius: 6, textDecoration: 'none',
            background: tab === 'comments' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
            color: tab === 'comments' ? 'rgba(var(--primary-rgb), 1)' : 'inherit',
            fontSize: '0.88rem', fontWeight: tab === 'comments' ? 600 : 400,
          }}
        >Comentarios ({comments.length})</Link>
      </nav>

      {tab === 'posts' && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {posts.map(p => (
            <li key={p.id} style={{
              padding: '0.7rem 0.85rem',
              border: '1px solid rgba(var(--primary-rgb), 0.08)',
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href={`/admin/alumnos/${p.user_id}`} style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                  {p.user_name ?? 'Sin nombre'}
                </Link>
                <span style={{ fontSize: '0.78rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>
                  {formatRelative(p.created_at)} · ♥ {p.likeCount} · 💬 {p.commentCount}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                {p.content.slice(0, 320)}{p.content.length > 320 ? '…' : ''}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                <Link href={`/community/${p.id}`} style={{ fontSize: '0.82rem', color: 'rgba(var(--primary-rgb), 1)' }}>
                  Ver post ↗
                </Link>
                <DeletePostBtn id={p.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'comments' && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {comments.map(c => (
            <li key={c.id} style={{
              padding: '0.7rem 0.85rem',
              border: '1px solid rgba(var(--primary-rgb), 0.08)',
              borderRadius: 6,
              display: 'flex', flexDirection: 'column', gap: '0.35rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href={`/admin/alumnos/${c.user_id}`} style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                  {c.user_name ?? 'Sin nombre'}
                </Link>
                <span style={{ fontSize: '0.78rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>
                  {formatRelative(c.created_at)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                {c.content.slice(0, 320)}{c.content.length > 320 ? '…' : ''}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link href={`/community/${c.post_id}`} style={{ fontSize: '0.82rem', color: 'rgba(var(--primary-rgb), 1)' }}>
                  Ver post ↗
                </Link>
                <DeleteCommentBtn id={c.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implement client delete buttons**

`app/admin/comunidad/DeletePostBtn.tsx`:

```typescript
'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deletePost } from './actions'

export default function DeletePostBtn({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  function handle() {
    if (!confirm('¿Eliminar este post? Esta acción no se puede deshacer.')) return
    startTransition(async () => { await deletePost(id); router.refresh() })
  }
  return (
    <button
      onClick={handle}
      disabled={isPending}
      style={{ background: 'transparent', border: 0, color: 'rgba(180, 60, 60, 1)', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}
    >
      {isPending ? 'Eliminando…' : 'Eliminar'}
    </button>
  )
}
```

`app/admin/comunidad/DeleteCommentBtn.tsx`:

```typescript
'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteComment } from './actions'

export default function DeleteCommentBtn({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  function handle() {
    if (!confirm('¿Eliminar este comentario? Esta acción no se puede deshacer.')) return
    startTransition(async () => { await deleteComment(id); router.refresh() })
  }
  return (
    <button
      onClick={handle}
      disabled={isPending}
      style={{ background: 'transparent', border: 0, color: 'rgba(180, 60, 60, 1)', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}
    >
      {isPending ? 'Eliminando…' : 'Eliminar'}
    </button>
  )
}
```

- [ ] **Step 5: Smoke test**

Run: `npm run dev`. Visit `/admin/comunidad`. Toggle tabs. Try deleting a test post/comment. Confirm content disappears.

- [ ] **Step 6: Commit**

```bash
git add app/admin/comunidad utils/admin/queries.ts
git commit -m "feat(admin): add /admin/comunidad moderation (posts + comments)"
```

---

## Phase 8 — Banner on `/dashboard` for admins

### Task 8.1: `AdminBanner` component

**Files:**
- Create: `components/admin/AdminBanner.tsx`
- Create: `components/admin/AdminBanner.module.css`
- Create: `__tests__/components/admin-banner.test.tsx`

- [ ] **Step 1: Write component test**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminBanner from '@/components/admin/AdminBanner'

describe('AdminBanner', () => {
  it('renders link to /admin', () => {
    render(<AdminBanner />)
    const a = screen.getByRole('link', { name: /panel de administración/i })
    expect(a).toHaveAttribute('href', '/admin')
  })
})
```

- [ ] **Step 2: Run test — fails**

Run: `npx vitest run __tests__/components/admin-banner.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `AdminBanner.tsx`**

```typescript
import Link from 'next/link'
import { ArrowUpRight, Shield } from 'lucide-react'
import styles from './AdminBanner.module.css'

export default function AdminBanner() {
  return (
    <Link href="/admin" className={styles.banner}>
      <span className={styles.icon} aria-hidden><Shield size={14} /></span>
      <span className={styles.text}>
        Tienes acceso al <strong>panel de administración</strong>
      </span>
      <ArrowUpRight size={14} aria-hidden className={styles.arrow} />
    </Link>
  )
}
```

- [ ] **Step 4: CSS**

```css
.banner {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.9rem;
  background: rgba(var(--primary-rgb), 0.08);
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  border-radius: 999px;
  text-decoration: none;
  color: var(--text-main);
  font-size: 0.85rem;
  transition: background-color 120ms;
  margin: 0 auto 1.5rem;
}

.banner:hover { background: rgba(var(--primary-rgb), 0.14); }

.icon {
  display: inline-flex;
  color: rgba(var(--primary-rgb), 1);
}
.text strong { color: rgba(var(--primary-rgb), 1); font-weight: 600; }
.arrow { color: rgba(var(--text-rgb, 30, 30, 30), 0.6); }
```

- [ ] **Step 5: Run test — passes**

Run: `npx vitest run __tests__/components/admin-banner.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/admin/AdminBanner.tsx components/admin/AdminBanner.module.css __tests__/components/admin-banner.test.tsx
git commit -m "feat(admin): add AdminBanner component for /dashboard"
```

### Task 8.2: Wire banner into `/dashboard`

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `components/DashboardClient.tsx`

- [ ] **Step 1: Update `app/dashboard/page.tsx` to read role**

In the existing `Promise.all`, replace the profile fetch:

```typescript
supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
```

After computing `firstName`, also extract role:

```typescript
const role = (profileResult.data?.role as 'member' | 'premium' | 'admin' | undefined) ?? 'member'
```

Pass it to `<DashboardClient>`:

```tsx
<DashboardClient
  greetingName={firstName}
  role={role}
  // ...rest unchanged
/>
```

- [ ] **Step 2: Update `components/DashboardClient.tsx`**

Add to the `Props` type:
```typescript
role: 'member' | 'premium' | 'admin'
```

Destructure in the function:
```typescript
export default function DashboardClient({ greetingName, role, myCourses, ... }) {
```

Import the banner at the top:
```typescript
import AdminBanner from '@/components/admin/AdminBanner'
```

Inside the hero section (just below the eyebrow `Reveal`), add:
```tsx
{role === 'admin' && (
  <Reveal delay={0.02}>
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <AdminBanner />
    </div>
  </Reveal>
)}
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`. As admin, visit `/dashboard` — the banner should appear above the title. Click it — should land on `/admin`. As non-admin, banner should not appear.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx components/DashboardClient.tsx
git commit -m "feat(admin): show AdminBanner on /dashboard for admin role"
```

---

## Phase 9 — Final polish

### Task 9.1: Update vitest coverage config

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Extend coverage globs**

Edit `vitest.config.ts`, replace the `coverage.include` block with:

```typescript
coverage: {
  reporter: ['text', 'lcov'],
  include: [
    'utils/**',
    'app/actions/**',
    'app/api/**',
    'app/login/**',
    'app/community/**',
    'app/courses/actions.ts',
    'app/profile/actions.ts',
    'app/auth/**',
    'app/admin/**/actions.ts',
  ],
},
```

- [ ] **Step 2: Verify**

Run: `npm run test`
Expected: all tests pass (no regressions).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore(admin): include admin server actions in test coverage"
```

### Task 9.2: Final E2E walkthrough (manual)

This is a manual smoke test, not a code task. No commit.

- [ ] **Step 1: Sign in as a non-admin user**

Visit `/admin` → redirected to `/dashboard`. Banner does not appear on `/dashboard`.

- [ ] **Step 2: Sign in as an admin**

Visit `/dashboard` → see banner → click → land on `/admin`. Verify the sidebar is visible, KPIs render, chart renders, all 6 sidebar items work.

- [ ] **Step 3: Smoke test each page**

- `/admin` — KPIs, chart, lists, quick actions all render.
- `/admin/alumnos` — search, filter, sort, pagination all work.
- `/admin/alumnos/[id]` — all 5 tabs render. Try each admin action (use a test account for delete!).
- `/admin/estadisticas` — all 6 charts render. Range picker works.
- `/admin/entregas` — pending and reviewed tabs work. "Corregir" link opens existing route.
- `/admin/cursos` — cards render. "Editar" and "+ Lección" links work.
- `/admin/comunidad` — posts and comments tabs work. Delete actions work.

- [ ] **Step 4: Mobile (<768px) sanity check**

Open dev tools, switch to mobile viewport. Sidebar drawer opens via burger; all pages stack properly.

---

## Self-checks for the implementer

Before opening a PR for any phase, verify:

1. `npm run lint` passes.
2. `npm run test` passes.
3. `npm run build` succeeds.
4. The phase's manual smoke test from the relevant Task is completed.
5. No `console.log` statements committed.
6. **Critical for v1 release:** the admin filled in real numbers in `utils/admin/plan-prices.ts`. Without this, MRR and per-month revenue charts read zero. The TODO comment in the file makes this explicit.


