# Admin Test Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin turn on "modo pruebas" (simulated payment, no Stripe) in production from `/admin`, scoped to their own browser via a signed cookie, so no real buyer can ever get the course for free.

**Architecture:** A signed HMAC cookie `lsb_test_mode` is the capability that enables simulation. Only an admin can mint it (a server action gated by `requireAdmin()`). Both checkout paths switch from checking `isDemoMode()` (environment-only) to `isTestPurchaseMode()` = `isDemoMode() OR valid cookie`. Without a valid cookie and in production, checkout always uses real Stripe.

**Tech Stack:** Next.js 16 (App Router, server actions, `next/headers` cookies, `next/cache` revalidatePath), Node `crypto` (HMAC-SHA256, timingSafeEqual), Supabase (admin gate via `requireAdmin`), Vitest (node + jsdom), Stripe (untouched in the demo branch).

## Global Constraints

- Cookie name: `lsb_test_mode` (exact).
- TTL: `2 * 60 * 60 * 1000` ms (2h). Cookie `maxAge`: `7200` seconds.
- Cookie options (exact): `{ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7200 }`.
- Signing: HMAC-SHA256 over the plaintext `expiryMs`; secret from `process.env.TEST_MODE_SECRET`. Compare with `crypto.timingSafeEqual` after an equal-length guard.
- **Fail-closed:** if `TEST_MODE_SECRET` is unset, `verifyToken` returns `false` and `signToken` throws → the feature is inert, checkout stays real.
- The cookie is the capability: verification never trusts the caller's role. Only an admin-gated action issues it.
- `isDemoMode()` in `utils/demo/mode.ts` stays unchanged (sync, env-only).
- Banner copy (exact): `⚠️ MODO PRUEBAS — los pagos son simulados, no se cobra nada`.
- Demo/simulated purchases keep writing `is_demo: true` (already implemented); do not change cleanup.
- Branch: `feat/admin-test-mode`.
- Test commands: `npx vitest run <file>` for one file; `npm run test` for all; `npx tsc --noEmit` for types; `npm run lint`.

---

## File Structure

- `utils/demo/test-mode.ts` (create) — token sign/verify, cookie read helpers, `isTestPurchaseMode`, config check, cookie options constant. One responsibility: the test-mode capability.
- `app/admin/pruebas/actions.ts` (create) — `enableTestMode` / `disableTestMode` server actions (admin-gated).
- `app/admin/pruebas/page.tsx` (create) — admin page showing state + toggle.
- `components/admin/TestModeToggle.tsx` (create) — client toggle UI.
- `app/api/checkout/route.ts` (modify) — web checkout honors `isTestPurchaseMode`.
- `app/curso-bachatango/comprar/actions.ts` (modify) — landing checkout honors `isTestPurchaseMode`.
- `app/gracias/page.tsx` (modify) — demo thank-you branch honors `isTestPurchaseMode`.
- `app/layout.tsx` (modify) — banner shows when `isTestPurchaseMode`.
- `components/DemoBanner.tsx` (modify) — copy change.
- `components/admin/AdminSidebar.tsx` (modify) — add "Modo pruebas" nav item.
- Tests: `__tests__/utils/test-mode.test.ts`, `__tests__/api/checkout.test.ts`, `__tests__/admin/test-mode-actions.test.ts`, `__tests__/components/TestModeToggle.test.tsx`, plus edits to `__tests__/actions/landing-checkout.test.ts`.

---

### Task 1: Test-mode capability module

**Files:**
- Create: `utils/demo/test-mode.ts`
- Test: `__tests__/utils/test-mode.test.ts`

**Interfaces:**
- Consumes: `isDemoMode` from `@/utils/demo/mode` (sync `() => boolean`); `cookies` from `next/headers` (async).
- Produces:
  - `TEST_COOKIE = 'lsb_test_mode'` (string const)
  - `TEST_TTL_MS = 7_200_000` (number const)
  - `TEST_COOKIE_OPTS` (object const, see Global Constraints)
  - `signToken(expiryMs: number): string` — throws if no secret
  - `verifyToken(value: string | undefined): boolean`
  - `readTestCookie(): Promise<boolean>`
  - `isTestPurchaseMode(): Promise<boolean>`
  - `testCookieExpiry(): Promise<number | null>` — expiryMs if valid, else null
  - `isTestModeConfigured(): boolean` — `!!process.env.TEST_MODE_SECRET`

- [ ] **Step 1: Write the failing test**

Create `__tests__/utils/test-mode.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCookieGet, mockIsDemoMode } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockIsDemoMode: vi.fn().mockReturnValue(false),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}))
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => mockIsDemoMode() }))

import {
  signToken, verifyToken, readTestCookie, isTestPurchaseMode,
  testCookieExpiry, isTestModeConfigured, TEST_COOKIE, TEST_COOKIE_OPTS,
} from '@/utils/demo/test-mode'

beforeEach(() => {
  vi.clearAllMocks()
  mockIsDemoMode.mockReturnValue(false)
  process.env.TEST_MODE_SECRET = 'unit-test-secret'
})
afterEach(() => { delete process.env.TEST_MODE_SECRET })

describe('signToken / verifyToken', () => {
  it('roundtrip válido → true', () => {
    expect(verifyToken(signToken(Date.now() + 60_000))).toBe(true)
  })
  it('expirado → false', () => {
    expect(verifyToken(signToken(Date.now() - 1000))).toBe(false)
  })
  it('hmac manipulado → false', () => {
    const t = signToken(Date.now() + 60_000)
    const bad = t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a')
    expect(verifyToken(bad)).toBe(false)
  })
  it('expiry manipulado (firma no cuadra) → false', () => {
    const t = signToken(Date.now() + 60_000)
    const sig = t.slice(t.indexOf('.') + 1)
    expect(verifyToken(`${Date.now() + 9_000_000}.${sig}`)).toBe(false)
  })
  it('ausente / vacía / sin punto → false', () => {
    expect(verifyToken(undefined)).toBe(false)
    expect(verifyToken('')).toBe(false)
    expect(verifyToken('nodot')).toBe(false)
  })
  it('firma de longitud distinta → false (sin excepción)', () => {
    const t = signToken(Date.now() + 60_000)
    const expiry = t.slice(0, t.indexOf('.'))
    expect(verifyToken(`${expiry}.abc`)).toBe(false)
  })
  it('sin secreto: verify siempre false, sign lanza', () => {
    const t = signToken(Date.now() + 60_000)
    delete process.env.TEST_MODE_SECRET
    expect(verifyToken(t)).toBe(false)
    expect(() => signToken(Date.now() + 60_000)).toThrow()
  })
  it('isTestModeConfigured refleja el secreto', () => {
    expect(isTestModeConfigured()).toBe(true)
    delete process.env.TEST_MODE_SECRET
    expect(isTestModeConfigured()).toBe(false)
  })
  it('TEST_COOKIE_OPTS tiene los flags de seguridad', () => {
    expect(TEST_COOKIE_OPTS).toEqual({
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7200,
    })
    expect(TEST_COOKIE).toBe('lsb_test_mode')
  })
})

describe('readTestCookie / isTestPurchaseMode / testCookieExpiry', () => {
  it('cookie válida → readTestCookie true', async () => {
    mockCookieGet.mockReturnValue({ value: signToken(Date.now() + 60_000) })
    expect(await readTestCookie()).toBe(true)
  })
  it('sin cookie → readTestCookie false', async () => {
    mockCookieGet.mockReturnValue(undefined)
    expect(await readTestCookie()).toBe(false)
  })
  it('env demo true → isTestPurchaseMode true aunque no haya cookie', async () => {
    mockIsDemoMode.mockReturnValue(true)
    mockCookieGet.mockReturnValue(undefined)
    expect(await isTestPurchaseMode()).toBe(true)
  })
  it('sin env demo + cookie válida → isTestPurchaseMode true', async () => {
    mockIsDemoMode.mockReturnValue(false)
    mockCookieGet.mockReturnValue({ value: signToken(Date.now() + 60_000) })
    expect(await isTestPurchaseMode()).toBe(true)
  })
  it('sin env demo + sin cookie → isTestPurchaseMode false', async () => {
    mockIsDemoMode.mockReturnValue(false)
    mockCookieGet.mockReturnValue(undefined)
    expect(await isTestPurchaseMode()).toBe(false)
  })
  it('testCookieExpiry: expiryMs si válida, null si no', async () => {
    const exp = Date.now() + 60_000
    mockCookieGet.mockReturnValue({ value: signToken(exp) })
    expect(await testCookieExpiry()).toBe(exp)
    mockCookieGet.mockReturnValue(undefined)
    expect(await testCookieExpiry()).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/utils/test-mode.test.ts`
Expected: FAIL — cannot resolve `@/utils/demo/test-mode` (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `utils/demo/test-mode.ts`:

```ts
/**
 * Modo pruebas activable por admin, con alcance PER-NAVEGADOR.
 *
 * Una cookie firmada (`lsb_test_mode`) es la CAPACIDAD que activa el pago
 * simulado. Solo un admin la emite (server action tras requireAdmin). La
 * verificación NO confía en el rol: la cookie es la prueba de que un admin la
 * emitió, lo que permite probar también el flujo guest (deslogueado).
 *
 * Fail-closed: sin TEST_MODE_SECRET, verifyToken→false y signToken lanza.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { isDemoMode } from './mode'

export const TEST_COOKIE = 'lsb_test_mode'
export const TEST_TTL_MS = 2 * 60 * 60 * 1000 // 2h

export const TEST_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: TEST_TTL_MS / 1000, // 7200s
}

function secret(): string | null {
  return process.env.TEST_MODE_SECRET || null
}

function hmac(s: string, data: string): string {
  return createHmac('sha256', s).update(data).digest('hex')
}

export function isTestModeConfigured(): boolean {
  return !!secret()
}

export function signToken(expiryMs: number): string {
  const s = secret()
  if (!s) throw new Error('TEST_MODE_SECRET no configurado')
  return `${expiryMs}.${hmac(s, String(expiryMs))}`
}

export function verifyToken(value: string | undefined): boolean {
  const s = secret()
  if (!s || !value) return false
  const dot = value.indexOf('.')
  if (dot <= 0) return false
  const expiryStr = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expiryMs = Number(expiryStr)
  if (!Number.isFinite(expiryMs)) return false
  const expected = hmac(s, expiryStr)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  if (!timingSafeEqual(a, b)) return false
  return Date.now() < expiryMs
}

export async function readTestCookie(): Promise<boolean> {
  const store = await cookies()
  return verifyToken(store.get(TEST_COOKIE)?.value)
}

export async function isTestPurchaseMode(): Promise<boolean> {
  return isDemoMode() || (await readTestCookie())
}

export async function testCookieExpiry(): Promise<number | null> {
  const store = await cookies()
  const value = store.get(TEST_COOKIE)?.value
  if (!verifyToken(value)) return null
  return Number(value!.slice(0, value!.indexOf('.')))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/utils/test-mode.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add utils/demo/test-mode.ts __tests__/utils/test-mode.test.ts
git commit -m "feat(test-mode): signed per-browser test-mode capability"
```

---

### Task 2: Wire the two checkouts

**Files:**
- Modify: `app/api/checkout/route.ts` (import line ~8; branch at line ~54)
- Modify: `app/curso-bachatango/comprar/actions.ts` (import line ~10; branch at line ~44)
- Test: `__tests__/api/checkout.test.ts` (create), `__tests__/actions/landing-checkout.test.ts` (edit mocks)

**Interfaces:**
- Consumes: `isTestPurchaseMode` from `@/utils/demo/test-mode` (async `() => Promise<boolean>`).
- Produces: nothing new; both handlers now `await isTestPurchaseMode()` where they used `isDemoMode()`.

- [ ] **Step 1: Update the landing test mocks to the new dependency**

In `__tests__/actions/landing-checkout.test.ts`:

Replace the hoisted mock name and the `vi.mock('@/utils/demo/mode', ...)` line. Change:

```ts
const { mockIsDemoMode, mockProvision, mockSessionCreate, mockCourseSingle, mockRedirect, mockRateLimit } = vi.hoisted(() => ({
  mockIsDemoMode: vi.fn(),
```
to:
```ts
const { mockIsTestPurchaseMode, mockProvision, mockSessionCreate, mockCourseSingle, mockRedirect, mockRateLimit } = vi.hoisted(() => ({
  mockIsTestPurchaseMode: vi.fn(),
```

Replace:
```ts
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => mockIsDemoMode() }))
```
with:
```ts
vi.mock('@/utils/demo/test-mode', () => ({ isTestPurchaseMode: () => mockIsTestPurchaseMode() }))
```

Then update every `mockIsDemoMode.mockReturnValue(true)` → `mockIsTestPurchaseMode.mockResolvedValue(true)` and every `mockIsDemoMode.mockReturnValue(false)` → `mockIsTestPurchaseMode.mockResolvedValue(false)` (4 occurrences: demo test, real test, missing-fields test, rate-limited test).

- [ ] **Step 2: Write the failing web-route test**

Create `__tests__/api/checkout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIsTestPurchaseMode, mockGetUser, mockCourseSingle, mockUpsert, mockSessionCreate } = vi.hoisted(() => ({
  mockIsTestPurchaseMode: vi.fn(),
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'u@x.com' } } }),
  mockCourseSingle: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 129, is_published: true }, error: null }),
  mockUpsert: vi.fn().mockResolvedValue({ error: null }),
  mockSessionCreate: vi.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }),
}))

vi.mock('@/utils/demo/test-mode', () => ({ isTestPurchaseMode: () => mockIsTestPurchaseMode() }))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockCourseSingle }),
  }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      upsert: mockUpsert,
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { stripe_customer_id: 'cus_1' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { stripe_customer_id: 'cus_1' }, error: null }),
    }),
  }),
}))
vi.mock('@/utils/stripe/server', () => ({ stripe: { checkout: { sessions: { create: mockSessionCreate } }, customers: { create: vi.fn().mockResolvedValue({ id: 'cus_1' }) } } }))
vi.mock('@/utils/stripe/config', () => ({ STRIPE_CONFIG: { CURRENCY: 'eur' } }))
vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: (string | null | undefined)[]) => parts.map(p => p ?? 'anon').join(':'),
}))
vi.mock('@/utils/auth/client-ip', () => ({ getClientIp: () => '1.2.3.4' }))

import { POST } from '@/app/api/checkout/route'

function post(body: unknown) {
  return new Request('http://localhost/api/checkout', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}
beforeEach(() => vi.clearAllMocks())

describe('POST /api/checkout', () => {
  it('test mode ON: simula (upsert is_demo, sin Stripe) y devuelve url al curso', async () => {
    mockIsTestPurchaseMode.mockResolvedValue(true)
    const res = await POST(post({ courseId: 'c1' }))
    const json = await res.json()
    expect(json.url).toBe('/courses/c1')
    expect(mockUpsert).toHaveBeenCalled()
    expect(mockUpsert.mock.calls[0][0]).toEqual(expect.objectContaining({ is_demo: true, source: 'web', course_id: 'c1' }))
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })
  it('test mode OFF: crea sesión Stripe real', async () => {
    mockIsTestPurchaseMode.mockResolvedValue(false)
    const res = await POST(post({ courseId: 'c1' }))
    const json = await res.json()
    expect(json.url).toBe('https://checkout.stripe.com/x')
    expect(mockSessionCreate).toHaveBeenCalled()
    expect(mockUpsert).not.toHaveBeenCalled()
  })
  it('sin sesión → 401', async () => {
    mockIsTestPurchaseMode.mockResolvedValue(false)
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await POST(post({ courseId: 'c1' }))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run __tests__/api/checkout.test.ts __tests__/actions/landing-checkout.test.ts`
Expected: FAIL — route/action still import `isDemoMode`; the `@/utils/demo/test-mode` mock isn't used yet, so `mockUpsert`/`mockSessionCreate` branch selection is wrong (and the landing file references the now-removed `mockIsDemoMode`).

- [ ] **Step 4: Wire the web route**

In `app/api/checkout/route.ts`, change the import (line ~8):
```ts
import { isDemoMode } from '@/utils/demo/mode';
```
to:
```ts
import { isTestPurchaseMode } from '@/utils/demo/test-mode';
```
and change the branch (line ~54):
```ts
    if (isDemoMode()) {
```
to:
```ts
    if (await isTestPurchaseMode()) {
```

- [ ] **Step 5: Wire the landing action**

In `app/curso-bachatango/comprar/actions.ts`, change the import (line ~10):
```ts
import { isDemoMode } from '@/utils/demo/mode';
```
to:
```ts
import { isTestPurchaseMode } from '@/utils/demo/test-mode';
```
and change the branch (line ~44):
```ts
  if (isDemoMode()) {
```
to:
```ts
  if (await isTestPurchaseMode()) {
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run __tests__/api/checkout.test.ts __tests__/actions/landing-checkout.test.ts`
Expected: PASS (all).

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add app/api/checkout/route.ts app/curso-bachatango/comprar/actions.ts __tests__/api/checkout.test.ts __tests__/actions/landing-checkout.test.ts
git commit -m "feat(checkout): honor per-browser test mode in web + landing checkout"
```

---

### Task 3: Wire the banner, thank-you page, and banner copy

**Files:**
- Modify: `app/layout.tsx` (import line ~9; banner at line ~124)
- Modify: `app/gracias/page.tsx` (import line ~5; comment line ~20; branch line ~21)
- Modify: `components/DemoBanner.tsx` (copy text)

**Interfaces:**
- Consumes: `isTestPurchaseMode` from `@/utils/demo/test-mode`.
- Produces: nothing new. These are server components with large dependency trees; they are verified by typecheck + build, not unit tests (the `isTestPurchaseMode` logic is already covered in Task 1).

- [ ] **Step 1: Update the layout banner condition**

In `app/layout.tsx`, change the import (line ~9):
```ts
import { isDemoMode } from '@/utils/demo/mode';
```
to:
```ts
import { isTestPurchaseMode } from '@/utils/demo/test-mode';
```
and the banner (line ~124). `RootLayout` is already `async`:
```tsx
          {isDemoMode() && <DemoBanner />}
```
to:
```tsx
          {(await isTestPurchaseMode()) && <DemoBanner />}
```

- [ ] **Step 2: Update the thank-you demo branch**

In `app/gracias/page.tsx`, change the import (line ~5):
```ts
import { isDemoMode } from '@/utils/demo/mode';
```
to:
```ts
import { isTestPurchaseMode } from '@/utils/demo/test-mode';
```
Update the comment (line ~20) and branch (line ~21). The page is an async server component:
```tsx
  // modo demo (en prod isDemoMode() es false y esta rama nunca se ejecuta).
  if (isDemoMode() && demo === '1' && demoEmail) {
```
to:
```tsx
  // modo pruebas: env demo, o cookie de test de un admin en este navegador.
  if ((await isTestPurchaseMode()) && demo === '1' && demoEmail) {
```

- [ ] **Step 3: Update the banner copy**

In `components/DemoBanner.tsx`, change the text line:
```tsx
      ⚠️ MODO DEMO — los pagos son simulados, no se cobra nada
```
to:
```tsx
      ⚠️ MODO PRUEBAS — los pagos son simulados, no se cobra nada
```

- [ ] **Step 4: Typecheck + build the changed pages**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (compiles `/`, `/gracias`, layout).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/gracias/page.tsx components/DemoBanner.tsx
git commit -m "feat(test-mode): show banner + gracias branch under test mode"
```

---

### Task 4: Admin activation server actions

**Files:**
- Create: `app/admin/pruebas/actions.ts`
- Test: `__tests__/admin/test-mode-actions.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` from `@/utils/auth/require-admin` (async, throws `AdminGuardError` if not admin); `TEST_COOKIE`, `TEST_COOKIE_OPTS`, `TEST_TTL_MS`, `signToken` from `@/utils/demo/test-mode`; `cookies` from `next/headers`; `revalidatePath` from `next/cache`.
- Produces: `enableTestMode(): Promise<void>`, `disableTestMode(): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/admin/test-mode-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSet, mockDelete, mockRevalidate, mockRequireAdmin } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockDelete: vi.fn(),
  mockRevalidate: vi.fn(),
  mockRequireAdmin: vi.fn().mockResolvedValue({ id: 'admin1' }),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ set: mockSet, delete: mockDelete }) }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidate }))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => mockRequireAdmin() }))

import { enableTestMode, disableTestMode } from '@/app/admin/pruebas/actions'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TEST_MODE_SECRET = 'unit-test-secret'
  mockRequireAdmin.mockResolvedValue({ id: 'admin1' })
})

describe('enableTestMode', () => {
  it('admin: setea lsb_test_mode con opciones seguras + revalida layout', async () => {
    await enableTestMode()
    expect(mockRequireAdmin).toHaveBeenCalled()
    const [name, value, opts] = mockSet.mock.calls[0]
    expect(name).toBe('lsb_test_mode')
    expect(typeof value).toBe('string')
    expect(value).toMatch(/^\d+\./)
    expect(opts).toEqual(expect.objectContaining({
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7200,
    }))
    expect(mockRevalidate).toHaveBeenCalledWith('/', 'layout')
  })
  it('no-admin (requireAdmin lanza): no setea cookie', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('forbidden'))
    await expect(enableTestMode()).rejects.toThrow()
    expect(mockSet).not.toHaveBeenCalled()
  })
  it('sin secreto: lanza y no setea cookie', async () => {
    delete process.env.TEST_MODE_SECRET
    await expect(enableTestMode()).rejects.toThrow()
    expect(mockSet).not.toHaveBeenCalled()
  })
})

describe('disableTestMode', () => {
  it('admin: borra la cookie + revalida layout', async () => {
    await disableTestMode()
    expect(mockRequireAdmin).toHaveBeenCalled()
    expect(mockDelete).toHaveBeenCalledWith({ name: 'lsb_test_mode', path: '/' })
    expect(mockRevalidate).toHaveBeenCalledWith('/', 'layout')
  })
  it('no-admin: no borra cookie', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('forbidden'))
    await expect(disableTestMode()).rejects.toThrow()
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/admin/test-mode-actions.test.ts`
Expected: FAIL — cannot resolve `@/app/admin/pruebas/actions`.

- [ ] **Step 3: Write minimal implementation**

Create `app/admin/pruebas/actions.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/utils/auth/require-admin'
import { TEST_COOKIE, TEST_COOKIE_OPTS, TEST_TTL_MS, signToken } from '@/utils/demo/test-mode'

export async function enableTestMode(): Promise<void> {
  await requireAdmin()
  const token = signToken(Date.now() + TEST_TTL_MS) // lanza si falta el secreto
  const store = await cookies()
  store.set(TEST_COOKIE, token, TEST_COOKIE_OPTS)
  revalidatePath('/admin/pruebas')
  revalidatePath('/', 'layout')
}

export async function disableTestMode(): Promise<void> {
  await requireAdmin()
  const store = await cookies()
  store.delete({ name: TEST_COOKIE, path: '/' })
  revalidatePath('/admin/pruebas')
  revalidatePath('/', 'layout')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/admin/test-mode-actions.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add app/admin/pruebas/actions.ts __tests__/admin/test-mode-actions.test.ts
git commit -m "feat(admin): enable/disable test-mode server actions (admin-gated)"
```

---

### Task 5: Admin UI — page, toggle, sidebar entry

**Files:**
- Create: `app/admin/pruebas/page.tsx`
- Create: `components/admin/TestModeToggle.tsx`
- Modify: `components/admin/AdminSidebar.tsx` (add nav item)
- Test: `__tests__/components/TestModeToggle.test.tsx`

**Interfaces:**
- Consumes: `enableTestMode`, `disableTestMode` from `@/app/admin/pruebas/actions`; `testCookieExpiry`, `isTestModeConfigured` from `@/utils/demo/test-mode`.
- Produces: `TestModeToggle` (default export) with props `{ active: boolean; expiresAt: number | null; configured: boolean }`.

- [ ] **Step 1: Write the failing component test**

Create `__tests__/components/TestModeToggle.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/admin/pruebas/actions', () => ({
  enableTestMode: vi.fn(),
  disableTestMode: vi.fn(),
}))

import TestModeToggle from '@/components/admin/TestModeToggle'

describe('TestModeToggle', () => {
  it('inactivo: muestra botón Activar', () => {
    render(<TestModeToggle active={false} expiresAt={null} configured={true} />)
    expect(screen.getByRole('button', { name: /activar/i })).toBeEnabled()
  })
  it('activo: muestra Desactivar y estado ACTIVO', () => {
    render(<TestModeToggle active={true} expiresAt={Date.now() + 3_600_000} configured={true} />)
    expect(screen.getByRole('button', { name: /desactivar/i })).toBeInTheDocument()
    expect(screen.getByText(/activo/i)).toBeInTheDocument()
  })
  it('sin configurar: avisa de TEST_MODE_SECRET y deshabilita Activar', () => {
    render(<TestModeToggle active={false} expiresAt={null} configured={false} />)
    expect(screen.getByText(/TEST_MODE_SECRET/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activar/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/TestModeToggle.test.tsx`
Expected: FAIL — cannot resolve `@/components/admin/TestModeToggle`.

- [ ] **Step 3: Write the toggle component**

Create `components/admin/TestModeToggle.tsx`:

```tsx
'use client'

import { enableTestMode, disableTestMode } from '@/app/admin/pruebas/actions'

type Props = { active: boolean; expiresAt: number | null; configured: boolean }

export default function TestModeToggle({ active, expiresAt, configured }: Props) {
  const expiresLabel =
    active && expiresAt
      ? new Date(expiresAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 520 }}>
      {!configured && (
        <p style={{ color: '#8a1c1c', fontWeight: 600 }}>
          Falta la variable <code>TEST_MODE_SECRET</code>. El modo pruebas está
          desactivado hasta configurarla.
        </p>
      )}

      {active ? (
        <>
          <p style={{ fontWeight: 600 }}>
            🟢 Modo pruebas ACTIVO en este navegador
            {expiresLabel ? ` — caduca a las ${expiresLabel}` : ''}.
          </p>
          <form action={disableTestMode}>
            <button type="submit" style={btn('#8a1c1c')}>Desactivar modo pruebas</button>
          </form>
        </>
      ) : (
        <>
          <p>El modo pruebas simula los pagos <strong>solo en este navegador</strong>. Caduca solo en 2 horas.</p>
          <form action={enableTestMode}>
            <button type="submit" disabled={!configured} style={btn('#0a7d33', !configured)}>
              Activar modo pruebas
            </button>
          </form>
        </>
      )}
    </div>
  )
}

function btn(bg: string, disabled = false): React.CSSProperties {
  return {
    background: disabled ? '#9aa' : bg,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.6rem 1rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/TestModeToggle.test.tsx`
Expected: PASS (all).

- [ ] **Step 5: Write the admin page**

Create `app/admin/pruebas/page.tsx`:

```tsx
import { testCookieExpiry, isTestModeConfigured } from '@/utils/demo/test-mode'
import TestModeToggle from '@/components/admin/TestModeToggle'

export const dynamic = 'force-dynamic'

export default async function AdminTestModePage() {
  const expiresAt = await testCookieExpiry()
  const configured = isTestModeConfigured()

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header>
        <span style={{ fontSize: '0.75rem', letterSpacing: '0.08em', opacity: 0.7 }}>PANEL · ADMIN</span>
        <h1 style={{ margin: '0.25rem 0' }}>Modo pruebas</h1>
        <p style={{ opacity: 0.8, maxWidth: 640 }}>
          Simula compras (sin cobro real) para probar los flujos de pago en el sitio
          en vivo. Afecta <strong>solo a este navegador</strong>: cualquier otro
          visitante paga con Stripe normalmente. Las compras de prueba quedan
          marcadas y se pueden borrar después.
        </p>
      </header>
      <TestModeToggle active={expiresAt !== null} expiresAt={expiresAt} configured={configured} />
    </div>
  )
}
```

- [ ] **Step 6: Add the sidebar nav item**

In `components/admin/AdminSidebar.tsx`:

Add `FlaskConical` to the lucide import block (with the other icons):
```tsx
  FlaskConical,
```
Add this entry to the `items` array (after the `comunidad` entry):
```tsx
    { href: '/admin/pruebas', label: 'Modo pruebas', Icon: FlaskConical },
```

- [ ] **Step 7: Typecheck, build, full test run**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds, `/admin/pruebas` compiles.

Run: `npm run test`
Expected: all tests pass (existing + new).

- [ ] **Step 8: Lint + commit**

Run: `npm run lint`
Expected: no errors.

```bash
git add app/admin/pruebas/page.tsx components/admin/TestModeToggle.tsx components/admin/AdminSidebar.tsx __tests__/components/TestModeToggle.test.tsx
git commit -m "feat(admin): /admin/pruebas UI toggle + sidebar entry"
```

---

## Operational (controller-run, not a TDD task)

`TEST_MODE_SECRET` must exist in every runtime for the feature to work (fail-closed without it):

- [ ] Generate a 32-byte hex secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- [ ] Add `TEST_MODE_SECRET=<hex>` to `.env.local`.
- [ ] Add `TEST_MODE_SECRET` to Vercel for **production + preview + development** (encrypted).
- [ ] Redeploy production so the new env var is live.
- [ ] Smoke check: on prod, `/admin/pruebas` → Activar → the "⚠️ MODO PRUEBAS" banner appears; buy on the landing → lands on `/gracias?demo=1` without Stripe; open the same course URL in a private window (no cookie) → real Stripe checkout. Then Desactivar.

---

## Self-Review

**Spec coverage:**
- test-mode.ts (signToken/verifyToken/readTestCookie/isTestPurchaseMode/testCookieExpiry/isTestModeConfigured/TEST_COOKIE_OPTS, fail-closed, timingSafeEqual) → Task 1. ✅
- Wire checkouts (route:54, landing:44) → Task 2. ✅
- Wire gracias:21, layout:124, DemoBanner copy → Task 3. ✅
- enableTestMode/disableTestMode (requireAdmin + cookie set/delete + revalidatePath) → Task 4. ✅
- Admin page + TestModeToggle + AdminSidebar entry → Task 5. ✅
- TEST_MODE_SECRET env var → Operational section. ✅
- Security (httpOnly, secure, sameSite, signed, 2h double bound, fail-closed) → enforced in Task 1 (opts + verify) and Task 4 (gated mint); asserted in tests. ✅
- Tests (sign/verify/gate/branches/banner) → Tasks 1,2,4,5. Banner/gracias/layout intentionally build-verified (documented in Task 3). ✅

**Placeholder scan:** none — every code step has full code.

**Type consistency:** `TEST_COOKIE`, `TEST_COOKIE_OPTS`, `TEST_TTL_MS`, `signToken`, `testCookieExpiry`, `isTestModeConfigured`, `isTestPurchaseMode` used identically across Tasks 1/2/3/4/5. `TestModeToggle` props `{ active, expiresAt, configured }` match between component (Task 5 step 3), its test (step 1), and the page (step 5). Server actions `enableTestMode`/`disableTestMode` signatures match across Task 4 and Task 5.
