# Landing Full Registration Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect the full registration (incl. password) on the landing purchase form, but create the Supabase account and send email only after Stripe confirms payment.

**Architecture:** The form submits all fields; `landingCheckout` validates, bcrypt-hashes the password, inserts a `pending_registrations` row, and starts Stripe Checkout carrying only an opaque `pendingId` in `client_reference_id`. The `checkout.session.completed` webhook reads the pending row, creates the account with the stored `password_hash`, populates the profile, records the purchase, deletes the pending row, and sends a Resend confirmation. A demo/test path provisions inline behind a prod-safety guard. An automated cron purges stale pending rows.

**Tech Stack:** Next.js 16 (App Router, server actions, route handlers), Supabase (`auth.admin.createUser({password_hash})`, service-role), Stripe Checkout, bcryptjs, Resend, Vitest.

## Global Constraints

- Password stored at rest **only** as a bcrypt hash (bcryptjs, cost 12, `$2a/$2b`). NEVER plaintext, NEVER AES, NEVER in `profiles`, NEVER in any Stripe field, NEVER logged. [MUST]
- Provision only when `session.payment_status === 'paid'` and `amount_total` is a present, non-negative integer. Do NOT require `amount_total === amount_expected` (coupons like `luisysara` legitimately reduce it). Record `amount_paid = amount_total`. [MUST]
- `pendingId` travels in Stripe `client_reference_id` (also mirrored in `metadata.pendingId`); the password/hash never enters any Stripe field. [MUST]
- Password fields never rehydrate after a validation error (never in `searchParams`/`defaultValue`). Only `email`, `fullName`, `courseId` may be re-echoed. [MUST]
- Existing-account branch: never set/overwrite the pre-existing user's password or email; discard the pending `password_hash`; do not clobber existing profile fields. [MUST]
- No user-enumeration oracle: an already-registered email yields a response indistinguishable from a fresh submission (no distinct inline "ya tienes cuenta"). [MUST]
- Idempotent resolve-or-create: SELECT profiles by email first; `createUser` only if absent; on `createUser` "already exists" re-SELECT and continue (never 500). Keep `course_purchases` upsert `onConflict:'stripe_session_id'` + swallow `23505` as idempotent success. [MUST]
- Strict op order in provisioner: resolve-or-create user → UPDATE profiles (new user only, enumerated columns) → upsert course_purchases (commit) → DELETE pending (last data op) → send email (last, once, gated on a genuine purchase insert). [MUST]
- Inline demo provisioning may write users only when triggered by the admin HMAC cookie (any DB), OR triggered by `isDemoMode()` against a **non-prod** Supabase ref (prod ref `jytokoxbsykoyifzbjkd`). Unknown env → fail closed. [MUST]
- Keep BOTH guest detectors during rollout: legacy `metadata.guest === '1'` AND new `pendingId`. [MUST]
- Password strength: min 8 + uppercase + lowercase + number. `acceptTerms` required. Age 16–100. Country in allowlist.
- Branch: `feat/landing-registration-form`.
- Commands: `npx vitest run <file>` (one file), `npm run test` (all), `npx tsc --noEmit`, `npm run build`, `npm run lint`.

---

## File Structure

New:
- `supabase/2026_07_pending_registrations.sql` — pending table + RLS deny.
- `supabase/2026_07_profiles_landing_columns.sql` — new profile columns.
- `utils/checkout/password-hash.ts` — `hashPassword(plain)`.
- `utils/auth/email.ts` — `EMAIL_RE`.
- `utils/i18n/countries.ts` — country list + `isValidCountry`.
- `utils/checkout/registration-validation.ts` — `validateRegistration(raw)`.
- `utils/checkout/demo-provision-guard.ts` — `canProvisionInline(...)`.
- `utils/checkout/provision-registration.ts` — `provisionFromPending(session, admin, opts)`.
- `utils/email/purchase-confirmation.ts` — `sendPurchaseConfirmation(...)`.
- `app/api/cron/purge-pending/route.ts` — scheduled purge.
- `vercel.json` — cron schedule (create if absent).

Modified:
- `package.json` — add `bcryptjs` + `@types/bcryptjs`.
- `components/LandingCheckoutForm.tsx` — 11 fields + client validation + error messages.
- `app/curso-bachatango/comprar/comprar.module.css` — styles for new fields.
- `app/curso-bachatango/comprar/actions.ts` — `landingCheckout` rewrite.
- `app/api/webhooks/stripe/route.ts` — new pendingId branch + `checkout.session.expired`.
- `sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry.client.config.ts` — password scrubber.
- `components/SignupForm.tsx` — `minLength` 6 → 8.

---

### Task 1: bcryptjs dependency + password-hash util

**Files:**
- Modify: `package.json`
- Create: `utils/checkout/password-hash.ts`
- Test: `__tests__/utils/password-hash.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>` — bcrypt hash, cost 12.

- [ ] **Step 1: Install the dependency**

Run: `npm install bcryptjs@^3.0.2 && npm install -D @types/bcryptjs@^2.4.6`
Expected: `package.json` gains `bcryptjs` in dependencies and `@types/bcryptjs` in devDependencies.

- [ ] **Step 2: Write the failing test**

Create `__tests__/utils/password-hash.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import { hashPassword } from '@/utils/checkout/password-hash'

describe('hashPassword', () => {
  it('produces a bcrypt $2a/$2b hash at cost 12 that verifies', async () => {
    const hash = await hashPassword('Bachata2026')
    expect(hash).toMatch(/^\$2[ab]\$12\$/)
    expect(await bcrypt.compare('Bachata2026', hash)).toBe(true)
    expect(await bcrypt.compare('wrong', hash)).toBe(false)
  })
  it('produces distinct hashes for the same input (salted)', async () => {
    expect(await hashPassword('Bachata2026')).not.toBe(await hashPassword('Bachata2026'))
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run __tests__/utils/password-hash.test.ts`
Expected: FAIL — cannot resolve `@/utils/checkout/password-hash`.

- [ ] **Step 4: Write the implementation**

Create `utils/checkout/password-hash.ts`:

```ts
import bcrypt from 'bcryptjs'

/**
 * Hash a plaintext password with bcrypt (cost 12). The hash is stored in
 * pending_registrations and later imported by Supabase GoTrue via
 * admin.createUser({ password_hash }). Plaintext is NEVER stored anywhere.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/utils/password-hash.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add package.json package-lock.json utils/checkout/password-hash.ts __tests__/utils/password-hash.test.ts
git commit -m "feat(checkout): bcrypt password-hash util for pending registrations"
```

---

### Task 2: Migrations — pending_registrations + profiles columns

**Files:**
- Create: `supabase/2026_07_pending_registrations.sql`
- Create: `supabase/2026_07_profiles_landing_columns.sql`

**Interfaces:**
- Produces: table `public.pending_registrations` and 6 new `public.profiles` columns consumed by Tasks 5/7.

No unit test (SQL applied to Supabase manually by the operator). Verified by reviewer for RLS/DDL correctness and by the operator applying it. The task deliverable is the two SQL files.

- [ ] **Step 1: Write the pending_registrations migration**

Create `supabase/2026_07_pending_registrations.sql`:

```sql
-- Pending landing registrations: holds the buyer's data (incl. a bcrypt
-- password_hash, NEVER plaintext) between form submit and payment confirmation.
-- The webhook creates the account from this row on checkout.session.completed
-- and deletes it. Service role only (webhook + landing action). No public access.
create table if not exists public.pending_registrations (
  id uuid primary key default gen_random_uuid(),   -- pendingId (Stripe client_reference_id)
  email text not null,
  full_name text,
  password_hash text not null,
  country text,
  city text,
  date_of_birth date,
  phone text,
  marketing_consent boolean not null default false,
  dance_level text,
  course_id uuid,
  amount_expected integer,                          -- cents, traceability only (not a hard gate)
  created_at timestamptz not null default now()
);

create index if not exists pending_registrations_created_at_idx
  on public.pending_registrations (created_at);

alter table public.pending_registrations enable row level security;

-- Explicit deny for anon/authenticated on all ops (service_role has BYPASSRLS).
drop policy if exists "pending_registrations_no_select" on public.pending_registrations;
drop policy if exists "pending_registrations_no_insert" on public.pending_registrations;
drop policy if exists "pending_registrations_no_update" on public.pending_registrations;
drop policy if exists "pending_registrations_no_delete" on public.pending_registrations;
create policy "pending_registrations_no_select" on public.pending_registrations for select using (false);
create policy "pending_registrations_no_insert" on public.pending_registrations for insert with check (false);
create policy "pending_registrations_no_update" on public.pending_registrations for update using (false);
create policy "pending_registrations_no_delete" on public.pending_registrations for delete using (false);
```

- [ ] **Step 2: Write the profiles-columns migration**

Create `supabase/2026_07_profiles_landing_columns.sql`:

```sql
-- Landing registration collects these; the provisioner UPDATEs them after
-- createUser (handle_new_user only sets id/email/full_name). NEVER stores the
-- password hash here (profiles is world-readable via RLS select using(true)).
alter table public.profiles
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists date_of_birth date,
  add column if not exists phone text,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists dance_level text;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/2026_07_pending_registrations.sql supabase/2026_07_profiles_landing_columns.sql
git commit -m "feat(db): pending_registrations table + profiles landing columns"
```

---

### Task 3: Shared validation (email, countries, registration validator)

**Files:**
- Create: `utils/auth/email.ts`
- Create: `utils/i18n/countries.ts`
- Create: `utils/checkout/registration-validation.ts`
- Test: `__tests__/utils/registration-validation.test.ts`

**Interfaces:**
- Produces:
  - `EMAIL_RE: RegExp` (email.ts)
  - `COUNTRIES: ReadonlyArray<{ code: string; name: string }>`, `isValidCountry(code: string): boolean` (countries.ts)
  - `type CleanRegistration = { fullName: string; email: string; password: string; country: string; city: string; dateOfBirth: string; danceLevel: string; phone: string | null; marketingConsent: boolean }`
  - `validateRegistration(raw: Record<string, FormDataEntryValue | null>): { ok: true; data: CleanRegistration } | { ok: false; code: string }` (registration-validation.ts)

- [ ] **Step 1: Write the failing test**

Create `__tests__/utils/registration-validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateRegistration } from '@/utils/checkout/registration-validation'

const base = {
  fullName: 'Ana Ruiz', email: 'ana@example.com',
  password: 'Bachata2026', repeatPassword: 'Bachata2026',
  country: 'ES', city: 'Madrid', dateOfBirth: '1995-05-20',
  danceLevel: 'principiante', phone: '', marketingConsent: '', acceptTerms: 'on',
}
const r = (o: Partial<typeof base>) => validateRegistration({ ...base, ...o })

describe('validateRegistration', () => {
  it('accepts a valid payload and returns cleaned data', () => {
    const out = r({})
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.email).toBe('ana@example.com')
      expect(out.data.marketingConsent).toBe(false)
      expect(out.data.phone).toBe(null)
      expect('repeatPassword' in out.data).toBe(false)
    }
  })
  it('lowercases/trims email', () => {
    const out = r({ email: '  Ana@Example.COM ' })
    expect(out.ok && out.data.email).toBe('ana@example.com')
  })
  it('rejects invalid email', () => { expect(r({ email: 'nope' })).toEqual({ ok: false, code: 'invalid_email' }) })
  it('rejects short password', () => { expect(r({ password: 'Ab1', repeatPassword: 'Ab1' })).toEqual({ ok: false, code: 'password_too_short' }) })
  it('rejects weak password (no uppercase/number)', () => {
    expect(r({ password: 'bachatabaila', repeatPassword: 'bachatabaila' })).toEqual({ ok: false, code: 'password_weak' })
  })
  it('rejects mismatched repeat', () => { expect(r({ repeatPassword: 'Different1' })).toEqual({ ok: false, code: 'password_mismatch' }) })
  it('rejects invalid country', () => { expect(r({ country: 'ZZ' })).toEqual({ ok: false, code: 'invalid_country' }) })
  it('rejects missing city', () => { expect(r({ city: '' })).toEqual({ ok: false, code: 'missing' }) })
  it('rejects too-young / future / too-old birthdate', () => {
    expect(r({ dateOfBirth: '2020-01-01' })).toEqual({ ok: false, code: 'invalid_birthdate' })
    expect(r({ dateOfBirth: '2999-01-01' })).toEqual({ ok: false, code: 'invalid_birthdate' })
    expect(r({ dateOfBirth: '1900-01-01' })).toEqual({ ok: false, code: 'invalid_birthdate' })
  })
  it('rejects invalid dance level', () => { expect(r({ danceLevel: 'pro' })).toEqual({ ok: false, code: 'missing' }) })
  it('requires accepted terms', () => { expect(r({ acceptTerms: '' })).toEqual({ ok: false, code: 'terms_not_accepted' }) })
  it('rejects malformed phone when present', () => { expect(r({ phone: 'abc' })).toEqual({ ok: false, code: 'invalid_phone' }) })
  it('accepts a valid phone', () => {
    const out = r({ phone: '+34 600 123 456' })
    expect(out.ok && out.data.phone).toBe('+34 600 123 456')
  })
  it('maps marketing checkbox on -> true', () => {
    const out = r({ marketingConsent: 'on' })
    expect(out.ok && out.data.marketingConsent).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/utils/registration-validation.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write email.ts**

Create `utils/auth/email.ts`:

```ts
/**
 * Shared email pattern. Promoted out of app/login/actions.ts so landingCheckout
 * and signup use the same validation.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

- [ ] **Step 4: Write countries.ts**

Create `utils/i18n/countries.ts`:

```ts
/**
 * Country allowlist for the landing registration form (Spanish names).
 * Kept intentionally broad but finite so the server can reject arbitrary input.
 */
export const COUNTRIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'ES', name: 'España' }, { code: 'MX', name: 'México' }, { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' }, { code: 'CL', name: 'Chile' }, { code: 'PE', name: 'Perú' },
  { code: 'VE', name: 'Venezuela' }, { code: 'EC', name: 'Ecuador' }, { code: 'UY', name: 'Uruguay' },
  { code: 'PY', name: 'Paraguay' }, { code: 'BO', name: 'Bolivia' }, { code: 'CR', name: 'Costa Rica' },
  { code: 'PA', name: 'Panamá' }, { code: 'DO', name: 'República Dominicana' }, { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' }, { code: 'SV', name: 'El Salvador' }, { code: 'NI', name: 'Nicaragua' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'CU', name: 'Cuba' },
  { code: 'US', name: 'Estados Unidos' }, { code: 'FR', name: 'Francia' }, { code: 'DE', name: 'Alemania' },
  { code: 'IT', name: 'Italia' }, { code: 'PT', name: 'Portugal' }, { code: 'GB', name: 'Reino Unido' },
  { code: 'IE', name: 'Irlanda' }, { code: 'NL', name: 'Países Bajos' }, { code: 'BE', name: 'Bélgica' },
  { code: 'CH', name: 'Suiza' }, { code: 'AT', name: 'Austria' }, { code: 'SE', name: 'Suecia' },
  { code: 'NO', name: 'Noruega' }, { code: 'DK', name: 'Dinamarca' }, { code: 'FI', name: 'Finlandia' },
  { code: 'PL', name: 'Polonia' }, { code: 'JP', name: 'Japón' }, { code: 'CA', name: 'Canadá' },
  { code: 'BR', name: 'Brasil' }, { code: 'AU', name: 'Australia' }, { code: 'OT', name: 'Otro' },
]

const CODES = new Set(COUNTRIES.map(c => c.code))
export function isValidCountry(code: string): boolean {
  return CODES.has(code)
}
```

- [ ] **Step 5: Write registration-validation.ts**

Create `utils/checkout/registration-validation.ts`:

```ts
import { EMAIL_RE } from '@/utils/auth/email'
import { MIN_PASSWORD_LENGTH } from '@/utils/auth/password'
import { isValidCountry } from '@/utils/i18n/countries'

export type CleanRegistration = {
  fullName: string
  email: string
  password: string
  country: string
  city: string
  dateOfBirth: string
  danceLevel: string
  phone: string | null
  marketingConsent: boolean
}

export type RegistrationResult =
  | { ok: true; data: CleanRegistration }
  | { ok: false; code: string }

const DANCE_LEVELS = new Set(['principiante', 'intermedio', 'avanzado'])
const PHONE_RE = /^[+()\d][\d\s()-]{5,19}$/

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

function ageFrom(iso: string): number | null {
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getUTCFullYear() - d.getUTCFullYear()
  const m = now.getUTCMonth() - d.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--
  return age
}

export function validateRegistration(
  raw: Record<string, FormDataEntryValue | null>,
): RegistrationResult {
  const fullName = str(raw.fullName)
  const email = str(raw.email).toLowerCase()
  const password = typeof raw.password === 'string' ? raw.password : ''
  const repeatPassword = typeof raw.repeatPassword === 'string' ? raw.repeatPassword : ''
  const country = str(raw.country)
  const city = str(raw.city)
  const dateOfBirth = str(raw.dateOfBirth)
  const danceLevel = str(raw.danceLevel)
  const phoneRaw = str(raw.phone)
  const marketingConsent = raw.marketingConsent === 'on' || raw.marketingConsent === 'true'
  const acceptTerms = raw.acceptTerms === 'on' || raw.acceptTerms === 'true'

  if (!fullName) return { ok: false, code: 'missing' }
  if (!EMAIL_RE.test(email)) return { ok: false, code: 'invalid_email' }
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, code: 'password_too_short' }
  if (!(/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)))
    return { ok: false, code: 'password_weak' }
  if (password !== repeatPassword) return { ok: false, code: 'password_mismatch' }
  if (!isValidCountry(country)) return { ok: false, code: 'invalid_country' }
  if (!city) return { ok: false, code: 'missing' }
  const age = ageFrom(dateOfBirth)
  if (age === null || age < 16 || age > 100) return { ok: false, code: 'invalid_birthdate' }
  if (!DANCE_LEVELS.has(danceLevel)) return { ok: false, code: 'missing' }
  if (phoneRaw && !PHONE_RE.test(phoneRaw)) return { ok: false, code: 'invalid_phone' }
  if (!acceptTerms) return { ok: false, code: 'terms_not_accepted' }

  return {
    ok: true,
    data: {
      fullName, email, password, country, city, dateOfBirth, danceLevel,
      phone: phoneRaw || null, marketingConsent,
    },
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run __tests__/utils/registration-validation.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add utils/auth/email.ts utils/i18n/countries.ts utils/checkout/registration-validation.ts __tests__/utils/registration-validation.test.ts
git commit -m "feat(checkout): shared registration validator (email, countries, fields)"
```

---

### Task 4: Demo/prod inline-provision guard

**Files:**
- Create: `utils/checkout/demo-provision-guard.ts`
- Test: `__tests__/utils/demo-provision-guard.test.ts`

**Interfaces:**
- Produces: `PROD_SUPABASE_REF = 'jytokoxbsykoyifzbjkd'`; `supabaseRefFromUrl(url: string): string | null`; `canProvisionInline(opts: { triggeredByAdminCookie: boolean; supabaseUrl: string | undefined }): boolean`

- [ ] **Step 1: Write the failing test**

Create `__tests__/utils/demo-provision-guard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canProvisionInline, supabaseRefFromUrl, PROD_SUPABASE_REF } from '@/utils/checkout/demo-provision-guard'

const PROD = `https://${PROD_SUPABASE_REF}.supabase.co`
const OTHER = 'https://abcdefabcdefabcdefgh.supabase.co'

describe('supabaseRefFromUrl', () => {
  it('extracts the project ref', () => {
    expect(supabaseRefFromUrl(PROD)).toBe(PROD_SUPABASE_REF)
    expect(supabaseRefFromUrl('not a url')).toBe(null)
  })
})

describe('canProvisionInline', () => {
  it('admin cookie: allowed on any DB incl prod', () => {
    expect(canProvisionInline({ triggeredByAdminCookie: true, supabaseUrl: PROD })).toBe(true)
    expect(canProvisionInline({ triggeredByAdminCookie: true, supabaseUrl: OTHER })).toBe(true)
  })
  it('env-trigger (isDemoMode) allowed only on non-prod DB', () => {
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: OTHER })).toBe(true)
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: PROD })).toBe(false)
  })
  it('unknown url with env-trigger fails closed', () => {
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: undefined })).toBe(false)
    expect(canProvisionInline({ triggeredByAdminCookie: false, supabaseUrl: 'garbage' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/utils/demo-provision-guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `utils/checkout/demo-provision-guard.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/utils/demo-provision-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add utils/checkout/demo-provision-guard.ts __tests__/utils/demo-provision-guard.test.ts
git commit -m "feat(checkout): inline-provision prod-safety guard"
```

---

### Task 5: Confirmation email util

**Files:**
- Create: `utils/email/purchase-confirmation.ts`
- Test: `__tests__/utils/purchase-confirmation.test.ts`

**Interfaces:**
- Produces: `sendPurchaseConfirmation(opts: { email: string; fullName: string | null; existingAccount: boolean }): Promise<void>` — sends via Resend; swallows errors (never throws — a failed email must not fail the webhook), logs on failure.

- [ ] **Step 1: Write the failing test**

Create `__tests__/utils/purchase-confirmation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_API_KEY = 're_test'
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) })
})

import { sendPurchaseConfirmation } from '@/utils/email/purchase-confirmation'

describe('sendPurchaseConfirmation', () => {
  it('new account: posts to Resend with the access copy', async () => {
    await sendPurchaseConfirmation({ email: 'ana@example.com', fullName: 'Ana', existingAccount: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const body = JSON.parse(init.body)
    expect(body.to).toEqual(['ana@example.com'])
    expect(body.from).toContain('noreply@luisysarabachatango.com')
    expect(body.html).toMatch(/contrase/i)
  })
  it('existing account: uses the "entra con tu cuenta" copy', async () => {
    await sendPurchaseConfirmation({ email: 'ana@example.com', fullName: null, existingAccount: true })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.html).toMatch(/cuenta/i)
  })
  it('never throws when Resend fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    await expect(sendPurchaseConfirmation({ email: 'a@b.com', fullName: 'A', existingAccount: false })).resolves.toBeUndefined()
  })
  it('no-op without RESEND_API_KEY', async () => {
    delete process.env.RESEND_API_KEY
    await sendPurchaseConfirmation({ email: 'a@b.com', fullName: 'A', existingAccount: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/utils/purchase-confirmation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `utils/email/purchase-confirmation.ts`:

```ts
const FROM = 'Luis y Sara Bachatango <noreply@luisysarabachatango.com>'
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'

/**
 * Post-payment confirmation. Sent as the LAST step of provisioning, exactly once
 * per genuine provision. Never throws: a failed email must not fail the webhook
 * (the purchase is already committed). No-op if RESEND_API_KEY is unset.
 */
export async function sendPurchaseConfirmation(opts: {
  email: string
  fullName: string | null
  existingAccount: boolean
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) return

  const hi = opts.fullName ? `Hola ${opts.fullName},` : 'Hola,'
  const html = opts.existingAccount
    ? `<h2>¡Compra confirmada! 🎉</h2><p>${hi} ya tienes acceso al curso. Como ya tenías una cuenta, entra con tu <b>contraseña habitual</b>. Si no la recuerdas, <a href="${BASE}/forgot-password">recupérala aquí</a>.</p><p><a href="${BASE}/login">Entrar al curso</a></p>`
    : `<h2>¡Bienvenido/a! 🎉</h2><p>${hi} tu compra está confirmada y tu cuenta lista. Entra con tu email y la <b>contraseña que elegiste</b> al comprar.</p><p><a href="${BASE}/login">Entrar al curso</a></p>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [opts.email],
        subject: 'Tu compra del CURSO BACHATANGO está lista',
        html,
      }),
    })
    if (!res.ok) {
      console.error('[purchase-confirmation] resend failed', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.error('[purchase-confirmation] resend threw', e)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/utils/purchase-confirmation.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add utils/email/purchase-confirmation.ts __tests__/utils/purchase-confirmation.test.ts
git commit -m "feat(email): post-payment purchase confirmation via Resend"
```

---

### Task 6: Provisioner — provisionFromPending

**Files:**
- Create: `utils/checkout/provision-registration.ts`
- Test: `__tests__/utils/provision-registration.test.ts`

**Interfaces:**
- Consumes: `sendPurchaseConfirmation` (Task 5).
- Produces: `provisionFromPending(session: Stripe.Checkout.Session, admin: SupabaseClient, opts?: { isDemo?: boolean }): Promise<{ ok: true; userId: string; created: boolean } | { ok: false; reason: string }>`
- The `pendingId` is read from `session.client_reference_id ?? session.metadata?.pendingId`.
- `opts.isDemo` (inline/demo path) marks `user_metadata.is_demo` + `course_purchases.is_demo` so `cleanup_demo_data.sql` can reap it.

- [ ] **Step 1: Write the failing test**

Create `__tests__/utils/provision-registration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

const sendMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/utils/email/purchase-confirmation', () => ({ sendPurchaseConfirmation: (...a: unknown[]) => sendMock(...a) }))

import { provisionFromPending } from '@/utils/checkout/provision-registration'

// Minimal chainable Supabase admin double. Models the exact chains the impl
// uses: profiles.update(cols).eq()  (2-link, awaitable), profiles
// .update({stripe_customer_id}).eq().is()  (3-link), and course_purchases
// .upsert().select('id')  (returns { data, error }).
function makeAdmin(opts: {
  pending?: Record<string, unknown> | null
  profileByEmail?: { id: string } | null
  createUser?: { id?: string; error?: { message: string; status?: number } }
  purchaseInserted?: Array<{ id: string }>          // [] => idempotent duplicate (no email)
  purchaseError?: { code?: string; message?: string }
  profileSequence?: Array<{ id: string } | null>    // successive profiles-by-email lookups (race)
} = {}) {
  const calls = { profileColumns: [] as unknown[], customerId: [] as unknown[], purchaseUpsert: [] as unknown[], pendingDelete: [] as string[], createUser: [] as unknown[] }
  const seq = opts.profileSequence
  let seqI = 0
  const nextProfile = () => seq ? (seq[Math.min(seqI++, seq.length - 1)] ?? null) : (opts.profileByEmail ?? null)
  const purchaseInserted = opts.purchaseInserted ?? [{ id: 'purch-1' }]
  const admin = {
    from(table: string) {
      if (table === 'pending_registrations') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.pending ?? null }) }) }),
          delete: () => ({ eq: (_c: string, id: string) => { calls.pendingDelete.push(id); return Promise.resolve({ error: null }) } }),
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: nextProfile() }) }) }),
          update: (payload: Record<string, unknown>) => {
            const isCustomerId = 'stripe_customer_id' in payload
            if (isCustomerId) calls.customerId.push(payload); else calls.profileColumns.push(payload)
            return { eq: () => isCustomerId ? { is: () => Promise.resolve({ error: null }) } : Promise.resolve({ error: null }) }
          },
        }
      }
      if (table === 'course_purchases') {
        return { upsert: (payload: unknown) => { calls.purchaseUpsert.push(payload); return { select: () => Promise.resolve(opts.purchaseError ? { data: null, error: opts.purchaseError } : { data: purchaseInserted, error: null }) } } }
      }
      throw new Error('unexpected table ' + table)
    },
    auth: { admin: { createUser: async (attrs: unknown) => {
      calls.createUser.push(attrs)
      if (opts.createUser?.error) return { data: { user: null }, error: opts.createUser.error }
      return { data: { user: { id: opts.createUser?.id ?? 'new-user' } }, error: null }
    } } },
    __calls: calls,
  }
  return admin as unknown as import('@supabase/supabase-js').SupabaseClient & { __calls: typeof calls }
}

const PENDING = {
  id: 'pend-1', email: 'ana@example.com', full_name: 'Ana', password_hash: '$2b$12$abc',
  country: 'ES', city: 'Madrid', date_of_birth: '1995-05-20', phone: '+34600', marketing_consent: true,
  dance_level: 'principiante', course_id: 'course-1', amount_expected: 12900,
}
const session = (over: Partial<Stripe.Checkout.Session> = {}) => ({
  id: 'cs_1', client_reference_id: 'pend-1', payment_status: 'paid', amount_total: 9900,
  customer: 'cus_1', metadata: {}, ...over,
} as unknown as Stripe.Checkout.Session)

beforeEach(() => vi.clearAllMocks())

describe('provisionFromPending', () => {
  it('new buyer: creates user (password_hash), updates enumerated profile cols, records purchase, deletes pending, emails (new)', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: null, createUser: { id: 'u-new' } })
    const res = await provisionFromPending(session(), admin)
    expect(res).toEqual({ ok: true, userId: 'u-new', created: true })
    expect(admin.__calls.createUser[0]).toEqual(expect.objectContaining({ email: 'ana@example.com', password_hash: '$2b$12$abc', email_confirm: true, user_metadata: { full_name: 'Ana' } }))
    // enumerated columns bucket only — never password_hash, never stripe_customer_id
    expect(admin.__calls.profileColumns[0]).toEqual(expect.objectContaining({ country: 'ES', city: 'Madrid', date_of_birth: '1995-05-20', phone: '+34600', marketing_consent: true, dance_level: 'principiante' }))
    expect(admin.__calls.profileColumns[0]).not.toHaveProperty('password_hash')
    expect(admin.__calls.customerId[0]).toEqual({ stripe_customer_id: 'cus_1' })
    expect(admin.__calls.purchaseUpsert[0]).toEqual(expect.objectContaining({ user_id: 'u-new', course_id: 'course-1', stripe_session_id: 'cs_1', amount_paid: 9900, source: 'landing' }))
    expect(admin.__calls.purchaseUpsert[0]).not.toHaveProperty('is_demo')
    expect(admin.__calls.pendingDelete).toEqual(['pend-1'])
    expect(sendMock).toHaveBeenCalledWith({ email: 'ana@example.com', fullName: 'Ana', existingAccount: false })
  })
  it('existing account: records purchase, NEVER creates user or writes enumerated profile cols/password; emails (existing)', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: { id: 'u-old' } })
    const res = await provisionFromPending(session(), admin)
    expect(res).toEqual({ ok: true, userId: 'u-old', created: false })
    expect(admin.__calls.createUser).toEqual([])
    expect(admin.__calls.profileColumns).toEqual([]) // no enumerated-column write for existing user
    expect(admin.__calls.purchaseUpsert[0]).toEqual(expect.objectContaining({ user_id: 'u-old' }))
    expect(admin.__calls.pendingDelete).toEqual(['pend-1'])
    expect(sendMock).toHaveBeenCalledWith({ email: 'ana@example.com', fullName: 'Ana', existingAccount: true })
  })
  it('isDemo: marks user_metadata.is_demo and purchase.is_demo', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: null, createUser: { id: 'u-new' } })
    await provisionFromPending(session(), admin, { isDemo: true })
    expect((admin.__calls.createUser[0] as { user_metadata: Record<string, unknown> }).user_metadata).toEqual(expect.objectContaining({ is_demo: true }))
    expect(admin.__calls.purchaseUpsert[0]).toEqual(expect.objectContaining({ is_demo: true }))
  })
  it('duplicate delivery (empty insert) -> no second email', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: { id: 'u-old' }, purchaseInserted: [] })
    const res = await provisionFromPending(session(), admin)
    expect(res.ok).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
    expect(admin.__calls.pendingDelete).toEqual(['pend-1'])
  })
  it('23505 (already owns course via other session) -> idempotent ok, refund-candidate log, NO email', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const admin = makeAdmin({ pending: PENDING, profileByEmail: { id: 'u-old' }, purchaseError: { code: '23505', message: 'dup' } })
    const res = await provisionFromPending(session(), admin)
    expect(res).toEqual({ ok: true, userId: 'u-old', created: false })
    expect(sendMock).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('double-charge candidate'), 'cs_1', 'u-old', 'course-1')
    expect(admin.__calls.pendingDelete).toEqual(['pend-1'])
  })
  it('non-23505 purchase error -> ok:false, pending NOT deleted (retryable)', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: { id: 'u-old' }, purchaseError: { code: '55000', message: 'boom' } })
    const res = await provisionFromPending(session(), admin)
    expect(res.ok).toBe(false)
    expect(admin.__calls.pendingDelete).toEqual([])
  })
  it('not paid -> no provision', async () => {
    const admin = makeAdmin({ pending: PENDING })
    expect(await provisionFromPending(session({ payment_status: 'unpaid' }), admin)).toEqual({ ok: false, reason: 'not-paid' })
    expect(admin.__calls.createUser).toEqual([])
  })
  it('missing amount_total -> no provision', async () => {
    const admin = makeAdmin({ pending: PENDING })
    expect(await provisionFromPending(session({ amount_total: null }), admin)).toEqual({ ok: false, reason: 'bad-amount' })
  })
  it('coupon (amount_total 9900 < expected 12900) still provisions', async () => {
    const admin = makeAdmin({ pending: PENDING, profileByEmail: null, createUser: { id: 'u-new' } })
    expect((await provisionFromPending(session({ amount_total: 9900 }), admin)).ok).toBe(true)
  })
  it('pending not found (retry after success) -> idempotent ok, no re-provision', async () => {
    const admin = makeAdmin({ pending: null })
    expect(await provisionFromPending(session(), admin)).toEqual({ ok: true, userId: '', created: false })
    expect(admin.__calls.createUser).toEqual([])
  })
  it('createUser already-exists race -> re-SELECT profile and continue (no 500), treated as existing', async () => {
    const admin = makeAdmin({ pending: PENDING, profileSequence: [null, { id: 'u-raced' }], createUser: { error: { message: 'already been registered', status: 422 } } })
    const res = await provisionFromPending(session(), admin)
    expect(res).toEqual({ ok: true, userId: 'u-raced', created: false })
    expect(admin.__calls.profileColumns).toEqual([]) // raced -> treated as existing, no enumerated write
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/utils/provision-registration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `utils/checkout/provision-registration.ts`:

```ts
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPurchaseConfirmation } from '@/utils/email/purchase-confirmation'

export type ProvisionResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; reason: string }

/**
 * Provisions a landing purchase from a pending_registrations row after Stripe
 * confirms payment. Idempotent, resolve-or-create, and never sets/overwrites an
 * existing user's password or profile. Op order (strict):
 *   resolve-or-create user -> UPDATE profiles (new user only) -> upsert purchase
 *   -> DELETE pending -> send email (last).
 */
export async function provisionFromPending(
  session: Stripe.Checkout.Session,
  admin: SupabaseClient,
  opts: { isDemo?: boolean } = {},
): Promise<ProvisionResult> {
  // Anti-fraud: only a genuinely paid session provisions. amount_total is
  // recorded (coupons legitimately reduce it); we do NOT require equality with
  // amount_expected, only that it is a valid non-negative integer.
  if (session.payment_status !== 'paid') return { ok: false, reason: 'not-paid' }
  const amount = session.amount_total
  if (typeof amount !== 'number' || amount < 0) return { ok: false, reason: 'bad-amount' }

  const pendingId = session.client_reference_id ?? session.metadata?.pendingId
  if (!pendingId) return { ok: false, reason: 'no-pending-id' }

  const { data: pending } = await admin
    .from('pending_registrations')
    .select('id, email, full_name, password_hash, country, city, date_of_birth, phone, marketing_consent, dance_level, course_id')
    .eq('id', pendingId)
    .maybeSingle()

  // Pending row already consumed (retry after a prior successful delivery) ->
  // idempotent success, do not re-provision.
  if (!pending) return { ok: true, userId: '', created: false }

  const email = String(pending.email).toLowerCase()
  const courseId = pending.course_id as string | null
  if (!courseId) return { ok: false, reason: 'no-course' }

  // Resolve-or-create.
  const { data: existing } = await admin
    .from('profiles').select('id').eq('email', email).maybeSingle()

  let userId: string | undefined = existing?.id
  let created = false

  if (!userId) {
    const userMeta: Record<string, unknown> = { full_name: pending.full_name ?? undefined }
    if (opts.isDemo) userMeta.is_demo = true // reapable by cleanup_demo_data
    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password_hash: pending.password_hash as string,
      email_confirm: true,
      user_metadata: userMeta,
    })
    if (createdUser?.user?.id) {
      userId = createdUser.user.id
      created = true
    } else {
      // Race: another delivery (or a prior signup) created the user between our
      // SELECT and createUser. Re-SELECT and continue — never 500.
      const { data: raced } = await admin
        .from('profiles').select('id').eq('email', email).maybeSingle()
      userId = raced?.id
      if (!userId) return { ok: false, reason: `create-failed:${createErr?.message ?? 'unknown'}` }
      // Fall through as an existing account (do not touch its password/profile).
      created = false
    }
  }

  // New account only: populate the enumerated profile columns. NEVER write
  // password_hash into profiles; NEVER clobber an existing user's fields.
  if (created) {
    await admin.from('profiles').update({
      country: pending.country ?? null,
      city: pending.city ?? null,
      date_of_birth: pending.date_of_birth ?? null,
      phone: pending.phone ?? null,
      marketing_consent: pending.marketing_consent ?? false,
      dance_level: pending.dance_level ?? null,
    }).eq('id', userId)
  }

  if (session.customer) {
    await admin.from('profiles')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', userId).is('stripe_customer_id', null)
  }

  // Purchase (idempotent). `.select('id')` reveals whether a GENUINE row was
  // inserted (vs an idempotent duplicate) so the email fires exactly once.
  const purchaseRow: Record<string, unknown> = {
    user_id: userId, course_id: courseId, stripe_session_id: session.id, amount_paid: amount, source: 'landing',
  }
  if (opts.isDemo) purchaseRow.is_demo = true
  const { data: inserted, error: purchaseError } = await admin.from('course_purchases')
    .upsert(purchaseRow, { onConflict: 'stripe_session_id', ignoreDuplicates: true })
    .select('id')
  if (purchaseError) {
    // 23505 = UNIQUE(user_id,course_id): user already owns this course via a
    // DIFFERENT session -> double payment, no second product. Idempotent
    // success, but flag distinctively as a refund candidate for ops. No email.
    if (purchaseError.code === '23505') {
      console.error('[double-charge candidate] session=%s user=%s course=%s', session.id, userId, courseId)
      await admin.from('pending_registrations').delete().eq('id', pendingId)
      return { ok: true, userId: userId as string, created }
    }
    return { ok: false, reason: `purchase-error:${purchaseError.message}` }
  }
  const genuineInsert = Array.isArray(inserted) && inserted.length > 0

  // Consume the pending row (last data op).
  await admin.from('pending_registrations').delete().eq('id', pendingId)

  // Email last, exactly once — only on a genuine new purchase insert. A
  // duplicate delivery (empty `inserted`) or an already-owned course does not
  // re-send.
  if (genuineInsert) {
    await sendPurchaseConfirmation({
      email,
      fullName: (pending.full_name as string | null) ?? null,
      existingAccount: !created,
    })
  }

  return { ok: true, userId: userId as string, created }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/utils/provision-registration.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add utils/checkout/provision-registration.ts __tests__/utils/provision-registration.test.ts
git commit -m "feat(checkout): provisionFromPending — account+purchase from paid session"
```

---

### Task 7: Webhook wiring — pendingId branch + session.expired

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Test: `__tests__/api/webhooks-pending.test.ts`

**Interfaces:**
- Consumes: `provisionFromPending` (Task 6).
- Behaviour: in `checkout.session.completed`, when `client_reference_id` or `metadata.pendingId` is present → call `provisionFromPending`; keep the legacy `metadata.guest === '1'` branch for in-flight pre-deploy sessions. Add a `checkout.session.expired` handler that deletes the pending row.

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/webhooks-pending.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockConstructEvent, mockProvision, mockDelete } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockProvision: vi.fn().mockResolvedValue({ ok: true, userId: 'u1', created: true }),
  mockDelete: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/utils/stripe/server', () => ({ stripe: { webhooks: { constructEvent: mockConstructEvent }, subscriptions: { retrieve: vi.fn() } } }))
vi.mock('@/utils/env/validate-prod', () => ({ assertProdEnv: () => {} }))
vi.mock('@/utils/checkout/provision-registration', () => ({ provisionFromPending: (...a: unknown[]) => mockProvision(...a) }))
vi.mock('@/utils/checkout/provision-guest', () => ({ provisionGuestPurchase: vi.fn().mockResolvedValue({ ok: true, userId: 'g1' }) }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({ get: () => 'sig' }) }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: () => ({ delete: () => ({ eq: (_c: string, id: string) => mockDelete(id) }) }),
  }),
}))

import { POST } from '@/app/api/webhooks/stripe/route'
const post = () => new Request('http://x/api/webhooks/stripe', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig' } })
beforeEach(() => vi.clearAllMocks())

describe('webhook pending-registration branch', () => {
  it('completed + client_reference_id -> provisionFromPending, 200', async () => {
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: 'pend-1', payment_status: 'paid', amount_total: 9900, metadata: {} } } })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(mockProvision).toHaveBeenCalledTimes(1)
  })
  it('provisionFromPending failure (db) -> 500 for retry', async () => {
    mockProvision.mockResolvedValueOnce({ ok: false, reason: 'purchase-error:x' })
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: 'pend-1', payment_status: 'paid', amount_total: 9900, metadata: {} } } })
    const res = await POST(post())
    expect(res.status).toBe(500)
  })
  it('not-paid reason -> 200 (no retry)', async () => {
    mockProvision.mockResolvedValueOnce({ ok: false, reason: 'not-paid' })
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: 'pend-1', payment_status: 'unpaid', amount_total: 9900, metadata: {} } } })
    const res = await POST(post())
    expect(res.status).toBe(200)
  })
  it('checkout.session.expired -> deletes the pending row, 200', async () => {
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.expired', data: { object: { id: 'cs_1', client_reference_id: 'pend-1', metadata: {} } } })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith('pend-1')
  })
  it('legacy guest branch (guest=1, no pendingId) still routes to provisionGuestPurchase', async () => {
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_2', payment_status: 'paid', metadata: { guest: '1', courseId: 'c1' } } } })
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(mockProvision).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/webhooks-pending.test.ts`
Expected: FAIL — the pendingId branch and expired handler don't exist yet.

- [ ] **Step 3: Add the import**

In `app/api/webhooks/stripe/route.ts`, add near the other imports:
```ts
import { provisionFromPending } from '@/utils/checkout/provision-registration';
```

- [ ] **Step 4: Add the pendingId branch inside `checkout.session.completed`**

In `app/api/webhooks/stripe/route.ts`, inside `if (event.type === 'checkout.session.completed') { ... }`, immediately after `const courseId = session.metadata?.courseId;`, insert this block BEFORE the existing `if (!userId) {` guest handling:

```ts
    // New landing registration flow: pendingId carried in client_reference_id
    // (mirrored in metadata.pendingId). Provision the account from the pending
    // row. Takes precedence over the legacy guest branch.
    const pendingId = session.client_reference_id ?? session.metadata?.pendingId;
    if (pendingId) {
      const result = await provisionFromPending(session, supabase);
      if (!result.ok) {
        console.error('Webhook: pending provisioning failed:', result.reason, 'session:', session.id);
        // Non-retryable reasons (validation/idempotent) -> 200. DB/create errors -> 500 for Stripe retry.
        const nonRetryable = ['not-paid', 'bad-amount', 'no-pending-id', 'no-course'];
        if (nonRetryable.includes(result.reason)) return new NextResponse(null, { status: 200 });
        return new NextResponse('Provisioning Error', { status: 500 });
      }
      return new NextResponse(null, { status: 200 });
    }
```

- [ ] **Step 5: Add the `checkout.session.expired` handler**

In `app/api/webhooks/stripe/route.ts`, add this block after the `checkout.session.completed` block (before the subscription-events block):

```ts
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const pendingId = session.client_reference_id ?? session.metadata?.pendingId;
    if (pendingId) {
      await supabase.from('pending_registrations').delete().eq('id', pendingId);
    }
    return new NextResponse(null, { status: 200 });
  }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run __tests__/api/webhooks-pending.test.ts`
Expected: PASS.

- [ ] **Step 7: Full suite + typecheck + commit**

Run: `npm run test` (confirm the existing webhook tests still pass)
Expected: all pass.
Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add app/api/webhooks/stripe/route.ts __tests__/api/webhooks-pending.test.ts
git commit -m "feat(webhook): provision from pending registration + purge on session.expired"
```

---

### Task 8: landingCheckout rewrite

**Files:**
- Modify: `app/curso-bachatango/comprar/actions.ts`
- Test: `__tests__/actions/landing-checkout.test.ts` (rewrite for the new flow)

**Interfaces:**
- Consumes: `validateRegistration` (Task 3), `hashPassword` (Task 1), `isTestPurchaseMode`/`readTestCookie` (existing), `canProvisionInline` (Task 4), `provisionFromPending` (Task 6).
- Behaviour: validate → hash → per-email/day rate limit → insert pending → Stripe session with `client_reference_id = pendingId`; on demo/test, provision inline (guarded); existing-email must NOT be revealed at form time (generic path — it proceeds to payment like a fresh submit).

- [ ] **Step 1: Write the failing tests (rewrite the file)**

Replace `__tests__/actions/landing-checkout.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const H = vi.hoisted(() => ({
  isTest: vi.fn().mockResolvedValue(false),
  readCookie: vi.fn().mockResolvedValue(false),
  hash: vi.fn().mockResolvedValue('$2b$12$hash'),
  provisionPending: vi.fn().mockResolvedValue({ ok: true, userId: 'u1', created: true }),
  sessionCreate: vi.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }),
  courseSingle: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 129 }, error: null }),
  pendingInsert: vi.fn().mockResolvedValue({ data: { id: 'pend-1' }, error: null }),
  pendingDelete: vi.fn().mockResolvedValue({ error: null }),
  redirect: vi.fn((u: string) => { throw new Error('REDIRECT:' + u) }),
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
}))
vi.mock('@/utils/demo/test-mode', () => ({ isTestPurchaseMode: () => H.isTest(), readTestCookie: () => H.readCookie() }))
vi.mock('@/utils/checkout/password-hash', () => ({ hashPassword: (p: string) => H.hash(p) }))
vi.mock('@/utils/checkout/provision-registration', () => ({ provisionFromPending: (...a: unknown[]) => H.provisionPending(...a) }))
vi.mock('@/utils/stripe/server', () => ({ stripe: { checkout: { sessions: { create: H.sessionCreate } } } }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => H.redirect(u) }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({ get: () => '' }) }))
vi.mock('@/utils/rate-limit', () => ({ rateLimit: (...a: unknown[]) => H.rateLimit(...a), rateLimitKey: (p: (string | null | undefined)[]) => p.map(x => x ?? 'anon').join(':') }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: (t: string) => t === 'pending_registrations'
      ? { insert: () => ({ select: () => ({ single: H.pendingInsert }) }), delete: () => ({ eq: (_c: string, v: string) => H.pendingDelete(v) }) }
      : { select: () => ({ eq: () => ({ eq: () => ({ single: H.courseSingle }) }) }) },
  }),
}))

import { landingCheckout } from '@/app/curso-bachatango/comprar/actions'
const fd = (o: Record<string, string>) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.append(k, v)); return f }
const valid = {
  courseId: 'c1', fullName: 'Ana', email: 'ana@example.com',
  password: 'Bachata2026', repeatPassword: 'Bachata2026', country: 'ES', city: 'Madrid',
  dateOfBirth: '1995-05-20', danceLevel: 'principiante', acceptTerms: 'on',
}
beforeEach(() => { vi.clearAllMocks(); H.isTest.mockResolvedValue(false); H.readCookie.mockResolvedValue(false); H.rateLimit.mockResolvedValue({ ok: true }) })

describe('landingCheckout (full registration)', () => {
  it('real: hashes password, inserts pending, creates Stripe session with client_reference_id=pendingId and NO password fields', async () => {
    await expect(landingCheckout(fd(valid))).rejects.toThrow('REDIRECT:https://checkout.stripe.com/x')
    expect(H.hash).toHaveBeenCalledWith('Bachata2026')
    const pendingRow = H.pendingInsert.mock.calls.length ? undefined : undefined // insert payload asserted below
    const arg = H.sessionCreate.mock.calls[0][0]
    expect(arg.client_reference_id).toBe('pend-1')
    expect(arg.metadata).toEqual(expect.objectContaining({ courseId: 'c1', source: 'landing', pendingId: 'pend-1' }))
    expect(arg.customer_email).toBe('ana@example.com')
    const asStr = JSON.stringify(arg).toLowerCase()
    expect(asStr).not.toContain('bachata2026')
    expect(asStr).not.toContain('password')
    expect(asStr).not.toContain('$2b$')
  })
  it('validation error: redirects with ?error= code and NEVER hashes or inserts', async () => {
    await expect(landingCheckout(fd({ ...valid, acceptTerms: '' }))).rejects.toThrow(/REDIRECT:.*error=terms_not_accepted/)
    expect(H.hash).not.toHaveBeenCalled()
    expect(H.pendingInsert).not.toHaveBeenCalled()
    expect(H.sessionCreate).not.toHaveBeenCalled()
  })
  it('password mismatch: error=password_mismatch', async () => {
    await expect(landingCheckout(fd({ ...valid, repeatPassword: 'Other1234' }))).rejects.toThrow(/error=password_mismatch/)
  })
  it('rate limited: redirects error=rate, no hash/insert', async () => {
    H.rateLimit.mockResolvedValue({ ok: false, retryAfter: 60 })
    await expect(landingCheckout(fd(valid))).rejects.toThrow(/error=rate/)
    expect(H.hash).not.toHaveBeenCalled()
  })
  it('demo/test with admin cookie: provisions inline (isDemo) with a password-free synthetic session, redirects to /gracias?demo=1', async () => {
    H.isTest.mockResolvedValue(true); H.readCookie.mockResolvedValue(true)
    await expect(landingCheckout(fd(valid))).rejects.toThrow(/REDIRECT:\/gracias\?demo=1/)
    expect(H.sessionCreate).not.toHaveBeenCalled()
    const [synthetic, , opts] = H.provisionPending.mock.calls[0] as [{ client_reference_id: string }, unknown, unknown]
    expect(opts).toEqual({ isDemo: true })
    expect(synthetic.client_reference_id).toBe('pend-1')
    const s = JSON.stringify(synthetic).toLowerCase()
    expect(s).not.toContain('bachata2026'); expect(s).not.toContain('password'); expect(s).not.toContain('$2b$')
  })
  it('demo without admin cookie against the prod ref: refuses, deletes pending, no provision', async () => {
    H.isTest.mockResolvedValue(true); H.readCookie.mockResolvedValue(false)
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jytokoxbsykoyifzbjkd.supabase.co'
    try {
      await expect(landingCheckout(fd(valid))).rejects.toThrow(/error=account_creation_failed/)
      expect(H.provisionPending).not.toHaveBeenCalled()
      expect(H.pendingDelete).toHaveBeenCalledWith('pend-1')
    } finally { process.env.NEXT_PUBLIC_SUPABASE_URL = prev }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/actions/landing-checkout.test.ts`
Expected: FAIL — the action still uses the old two-field flow.

- [ ] **Step 3: Rewrite the action**

Replace `app/curso-bachatango/comprar/actions.ts` with:

```ts
'use server';

import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type Stripe from 'stripe';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe/server';
import { STRIPE_CONFIG } from '@/utils/stripe/config';
import { isTestPurchaseMode, readTestCookie } from '@/utils/demo/test-mode';
import { canProvisionInline } from '@/utils/checkout/demo-provision-guard';
import { provisionFromPending } from '@/utils/checkout/provision-registration';
import { validateRegistration } from '@/utils/checkout/registration-validation';
import { hashPassword } from '@/utils/checkout/password-hash';
import { rateLimit, rateLimitKey } from '@/utils/rate-limit';
import { getClientIp } from '@/utils/auth/client-ip';

export async function landingCheckout(formData: FormData): Promise<void> {
  const ip = getClientIp(await headers());
  const courseId = ((formData.get('courseId') as string | null) ?? '').trim();
  // Safe fields re-echoed after a validation error (never the password).
  const rawName = ((formData.get('fullName') as string | null) ?? '').trim();
  const rawEmail = ((formData.get('email') as string | null) ?? '').trim();
  const back = (code: string) =>
    `/curso-bachatango/comprar?courseId=${encodeURIComponent(courseId)}&error=${code}` +
    `&name=${encodeURIComponent(rawName)}&email=${encodeURIComponent(rawEmail)}`;

  // Rate limit against abuse of the unauthenticated pending INSERT (accumulates
  // PII + bcrypt hashes): per-IP burst, per-email/day, AND a per-IP/day row cap
  // so one IP cycling many distinct emails is still bounded.
  const rlIp = await rateLimit(rateLimitKey([ip, 'landing-checkout']), 10, 60_000);
  if (!rlIp.ok) redirect(back('rate'));
  const emailForKey = rawEmail.toLowerCase();
  const rlEmail = await rateLimit(rateLimitKey([emailForKey || ip, 'landing-checkout-email']), 5, 24 * 60 * 60_000);
  if (!rlEmail.ok) redirect(back('rate'));
  const rlIpDay = await rateLimit(rateLimitKey([ip, 'landing-checkout-ip-day']), 30, 24 * 60 * 60_000);
  if (!rlIpDay.ok) redirect(back('rate'));

  // Validate ALL fields BEFORE any hashing or DB write.
  const v = validateRegistration({
    fullName: formData.get('fullName'), email: formData.get('email'),
    password: formData.get('password'), repeatPassword: formData.get('repeatPassword'),
    country: formData.get('country'), city: formData.get('city'),
    dateOfBirth: formData.get('dateOfBirth'), danceLevel: formData.get('danceLevel'),
    phone: formData.get('phone'), marketingConsent: formData.get('marketingConsent'),
    acceptTerms: formData.get('acceptTerms'),
  });
  if (!courseId) redirect(back('missing'));
  if (!v.ok) redirect(back(v.code));
  const reg = v.data;

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: course } = await admin
    .from('courses').select('title, price_eur').eq('id', courseId).eq('is_published', true).single();
  if (!course || !course.price_eur || course.price_eur <= 0 || course.price_eur > 10000) {
    redirect(back('course'));
  }
  const amountExpected = Math.round(course.price_eur * 100);

  // Hash the password into a local const; the plaintext is dropped immediately
  // after and NEVER logged, echoed, or sent to Stripe.
  const passwordHash = await hashPassword(reg.password);

  // Dedupe: drop any prior un-consumed pending row for this email so abandoned
  // attempts don't accumulate PII + hashes.
  await admin.from('pending_registrations').delete().eq('email', reg.email);

  // Insert the pending row; its id is the opaque pendingId.
  const { data: pending, error: pendingErr } = await admin
    .from('pending_registrations')
    .insert({
      id: randomUUID(),
      email: reg.email, full_name: reg.fullName, password_hash: passwordHash,
      country: reg.country, city: reg.city, date_of_birth: reg.dateOfBirth,
      phone: reg.phone, marketing_consent: reg.marketingConsent, dance_level: reg.danceLevel,
      course_id: courseId, amount_expected: amountExpected,
    })
    .select('id')
    .single();
  if (pendingErr || !pending) redirect(back('account_creation_failed'));
  const pendingId = pending.id as string;

  // Demo/test: provision inline (simulate the webhook) behind the prod guard.
  // On ANY handled failure or guard refusal, delete the pending row (it holds
  // the password_hash + PII) — never leave it for the 30-day cron.
  if (await isTestPurchaseMode()) {
    const triggeredByAdminCookie = await readTestCookie();
    if (!canProvisionInline({ triggeredByAdminCookie, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL })) {
      await admin.from('pending_registrations').delete().eq('id', pendingId);
      redirect(back('account_creation_failed'));
    }
    const synthetic = {
      id: `demo_${randomUUID()}`,
      client_reference_id: pendingId,
      payment_status: 'paid',
      amount_total: amountExpected,
      customer: null,
      metadata: { courseId, source: 'landing', pendingId },
    } as unknown as Stripe.Checkout.Session;
    let provisioned = false;
    try {
      const r = await provisionFromPending(synthetic, admin, { isDemo: true });
      provisioned = r.ok;
    } catch {
      provisioned = false;
    }
    if (!provisioned) {
      await admin.from('pending_registrations').delete().eq('id', pendingId);
      redirect(back('account_creation_failed'));
    }
    redirect(`/gracias?demo=1&email=${encodeURIComponent(reg.email)}`);
  }

  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  let url: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      customer_creation: 'always',
      customer_email: reg.email,
      client_reference_id: pendingId,
      line_items: [{
        price_data: { currency: STRIPE_CONFIG.CURRENCY, unit_amount: amountExpected, product_data: { name: course.title } },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${origin}/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/curso-bachatango`,
      metadata: { courseId, source: 'landing', pendingId },
      allow_promotion_codes: true,
    });
    url = session.url;
  } catch (e) {
    console.error('[landingCheckout] stripe', e);
  }
  if (!url) redirect(back('stripe'));
  redirect(url);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/actions/landing-checkout.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add app/curso-bachatango/comprar/actions.ts __tests__/actions/landing-checkout.test.ts
git commit -m "feat(landing): full-registration checkout — validate, hash, pending, stripe"
```

---

### Task 9: Form redesign — LandingCheckoutForm (11 fields)

**Files:**
- Modify: `components/LandingCheckoutForm.tsx`
- Modify: `app/curso-bachatango/comprar/comprar.module.css` (append field styles)
- Modify: `app/curso-bachatango/comprar/page.tsx` (re-echo name/email from searchParams after a validation error)
- Test: `__tests__/components/landing-checkout-form.test.tsx`

**Interfaces:**
- Consumes: `landingCheckout` (Task 8), `COUNTRIES` (Task 3).
- Props unchanged: `{ courseId: string; defaultEmail: string; defaultName: string; error?: string }`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/landing-checkout-form.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/curso-bachatango/comprar/actions', () => ({ landingCheckout: vi.fn() }))
import LandingCheckoutForm from '@/components/LandingCheckoutForm'

describe('LandingCheckoutForm', () => {
  it('renders all required registration fields', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    for (const name of ['fullName', 'email', 'password', 'repeatPassword', 'country', 'city', 'dateOfBirth', 'danceLevel', 'phone', 'acceptTerms']) {
      expect(document.querySelector(`[name="${name}"]`)).toBeTruthy()
    }
    expect(document.querySelector('[name="marketingConsent"]')).toBeTruthy()
  })
  it('password inputs are type=password and NOT pre-filled from any value', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="ana@x.com" defaultName="Ana" error="password_mismatch" />)
    const pw = document.querySelector('[name="password"]') as HTMLInputElement
    const rpw = document.querySelector('[name="repeatPassword"]') as HTMLInputElement
    expect(pw.type).toBe('password')
    expect(pw.value).toBe('')
    expect(rpw.value).toBe('')
  })
  it('shows a specific message for the error code', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" error="password_weak" />)
    expect(screen.getByText(/may[uú]scula/i)).toBeInTheDocument()
  })
  it('acceptTerms is required and marketingConsent is not', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    expect((document.querySelector('[name="acceptTerms"]') as HTMLInputElement).required).toBe(true)
    expect((document.querySelector('[name="marketingConsent"]') as HTMLInputElement).required).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/landing-checkout-form.test.tsx`
Expected: FAIL — old form has only name+email.

- [ ] **Step 3: Rewrite the component**

Replace `components/LandingCheckoutForm.tsx` with:

```tsx
'use client';

import { landingCheckout } from '@/app/curso-bachatango/comprar/actions';
import { COUNTRIES } from '@/utils/i18n/countries';
import styles from '@/app/curso-bachatango/comprar/comprar.module.css';

interface Props { courseId: string; defaultEmail: string; defaultName: string; error?: string }

const ERROR_MESSAGES: Record<string, string> = {
  missing: 'Rellena todos los campos obligatorios.',
  invalid_email: 'El email no es válido.',
  password_too_short: 'La contraseña debe tener al menos 8 caracteres.',
  password_weak: 'La contraseña debe incluir mayúscula, minúscula y número.',
  password_mismatch: 'Las contraseñas no coinciden.',
  invalid_country: 'Selecciona un país válido.',
  invalid_birthdate: 'Introduce una fecha de nacimiento válida (edad 16–100).',
  invalid_phone: 'El teléfono no es válido.',
  terms_not_accepted: 'Debes aceptar los términos y la privacidad.',
  account_creation_failed: 'No pudimos procesar tu registro. Inténtalo de nuevo.',
  rate: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  stripe: 'No pudimos iniciar el pago. Inténtalo de nuevo.',
  course: 'Este curso no está disponible.',
};

export default function LandingCheckoutForm({ courseId, defaultEmail, defaultName, error }: Props) {
  const message = error ? (ERROR_MESSAGES[error] ?? 'Revisa tus datos e inténtalo de nuevo.') : null;
  return (
    <form action={landingCheckout} className={styles.form}>
      <input type="hidden" name="courseId" value={courseId} />
      {message && <p className={styles.error}>{message}</p>}

      <label className={styles.label} htmlFor="lc-name">Nombre completo</label>
      <input id="lc-name" name="fullName" type="text" required defaultValue={defaultName} className={styles.input} autoComplete="name" />

      <label className={styles.label} htmlFor="lc-email">Email</label>
      <input id="lc-email" name="email" type="email" required defaultValue={defaultEmail} placeholder="tu@email.com" className={styles.input} autoComplete="email" />

      <label className={styles.label} htmlFor="lc-password">Contraseña</label>
      <input id="lc-password" name="password" type="password" required minLength={8} className={styles.input} autoComplete="new-password" placeholder="Mín. 8, con mayúscula, minúscula y número" />

      <label className={styles.label} htmlFor="lc-password2">Repetir contraseña</label>
      <input id="lc-password2" name="repeatPassword" type="password" required minLength={8} className={styles.input} autoComplete="new-password" />

      <label className={styles.label} htmlFor="lc-country">País</label>
      <select id="lc-country" name="country" required defaultValue="" className={styles.input}>
        <option value="" disabled>Selecciona tu país</option>
        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>

      <label className={styles.label} htmlFor="lc-city">Ciudad</label>
      <input id="lc-city" name="city" type="text" required className={styles.input} autoComplete="address-level2" />

      <label className={styles.label} htmlFor="lc-dob">Fecha de nacimiento</label>
      <input id="lc-dob" name="dateOfBirth" type="date" required className={styles.input} />

      <label className={styles.label} htmlFor="lc-level">Nivel de baile</label>
      <select id="lc-level" name="danceLevel" required defaultValue="" className={styles.input}>
        <option value="" disabled>Selecciona tu nivel</option>
        <option value="principiante">Principiante</option>
        <option value="intermedio">Intermedio</option>
        <option value="avanzado">Avanzado</option>
      </select>

      <label className={styles.label} htmlFor="lc-phone">Teléfono (WhatsApp) · opcional</label>
      <input id="lc-phone" name="phone" type="tel" className={styles.input} autoComplete="tel" placeholder="+34 600 123 456" />

      <label className={styles.checkboxRow}>
        <input name="marketingConsent" type="checkbox" value="on" />
        <span>Quiero recibir novedades y ofertas por email.</span>
      </label>

      <label className={styles.checkboxRow}>
        <input name="acceptTerms" type="checkbox" value="on" required />
        <span>Acepto los <a href="/legal/terms" target="_blank" rel="noopener noreferrer">términos</a> y la <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">privacidad</a>.</span>
      </label>

      <button type="submit" className={styles.button}>Continuar al pago</button>
      <p className={styles.note}>Creamos tu cuenta al confirmarse el pago. No se cobra nada hasta entonces.</p>
    </form>
  );
}
```

- [ ] **Step 4: Append checkbox styles to the module**

Append to `app/curso-bachatango/comprar/comprar.module.css`:

```css
.checkboxRow {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
  line-height: 1.35;
  margin: 0.25rem 0;
}
.checkboxRow input {
  margin-top: 0.2rem;
  flex-shrink: 0;
}
.checkboxRow a {
  text-decoration: underline;
}
```

- [ ] **Step 5: Re-echo name/email in the page after a validation error**

In `app/curso-bachatango/comprar/page.tsx`, extend the searchParams type and pass the re-echoed values (the action redirects with `&name=&email=`). Change the searchParams type to `{ courseId?: string; error?: string; name?: string; email?: string }`, read them, and change the render to:

```tsx
  const { courseId, error, name, email } = await props.searchParams;
```
and:
```tsx
        <LandingCheckoutForm courseId={course.id} defaultEmail={email ?? user?.email ?? ''} defaultName={name ?? ''} error={error} />
```
(Password is never re-echoed — only these safe fields.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run __tests__/components/landing-checkout-form.test.tsx`
Expected: PASS.

- [ ] **Step 7: Build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds (`/curso-bachatango/comprar` compiles).

```bash
git add components/LandingCheckoutForm.tsx app/curso-bachatango/comprar/comprar.module.css app/curso-bachatango/comprar/page.tsx __tests__/components/landing-checkout-form.test.tsx
git commit -m "feat(landing): full registration form UI (11 fields + validation copy)"
```

---

### Task 10: Purge cron + Sentry scrubber + SignupForm minLength fix

**Files:**
- Create: `app/api/cron/purge-pending/route.ts`
- Create: `vercel.json` (or merge crons if it exists)
- Create: `utils/sentry/scrub.ts` (recursive password scrubber)
- Modify: `sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry.client.config.ts`
- Modify: `app/login/actions.ts` (import shared `EMAIL_RE`)
- Modify: `components/SignupForm.tsx`
- Test: `__tests__/api/purge-pending.test.ts`, `__tests__/utils/sentry-scrub.test.ts`

**Interfaces:**
- New env var `CRON_SECRET` (operator-provisioned). The route authorizes on `authorization: Bearer <CRON_SECRET>`.
- Produces: `scrubSensitive(event)` (utils/sentry/scrub.ts) — recursively replaces `password`/`repeatPassword`/`repeat_password`/`password_hash` values with `[Filtered]`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/purge-pending.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockLt, mockDelete } = vi.hoisted(() => ({ mockLt: vi.fn().mockResolvedValue({ error: null, count: 3 }), mockDelete: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: () => ({ delete: () => { mockDelete(); return { lt: (_c: string, v: string) => mockLt(v) } } }),
  }),
}))

import { GET } from '@/app/api/cron/purge-pending/route'
beforeEach(() => { vi.clearAllMocks(); process.env.CRON_SECRET = 'secret123' })
const req = (auth?: string) => new Request('http://x/api/cron/purge-pending', { headers: auth ? { authorization: auth } : {} })

describe('GET /api/cron/purge-pending', () => {
  it('401 without the correct bearer', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
    expect(mockDelete).not.toHaveBeenCalled()
  })
  it('authorized: deletes rows older than the TTL', async () => {
    const res = await GET(req('Bearer secret123'))
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalled()
    const cutoff = mockLt.mock.calls[0][0]
    expect(typeof cutoff).toBe('string')
    expect(Number.isNaN(Date.parse(cutoff))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/purge-pending.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 3: Write the purge route**

Create `app/api/cron/purge-pending/route.ts`:

```ts
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// TTL comfortably beyond Stripe's async settlement/retry window so a
// late-settling paid session is never dropped before its webhook lands.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: Request): Promise<NextResponse> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  const { error } = await admin.from('pending_registrations').delete().lt('created_at', cutoff);
  if (error) {
    console.error('[purge-pending] failed', error);
    return new NextResponse('Error', { status: 500 });
  }
  return NextResponse.json({ ok: true, cutoff });
}
```

- [ ] **Step 4: Add the Vercel cron schedule**

Create `vercel.json` (if it already exists, merge the `crons` array):

```json
{
  "crons": [
    { "path": "/api/cron/purge-pending", "schedule": "0 4 * * *" }
  ]
}
```

- [ ] **Step 5: Write the failing scrubber test**

Create `__tests__/utils/sentry-scrub.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scrubSensitive } from '@/utils/sentry/scrub'

describe('scrubSensitive', () => {
  it('filters sensitive keys recursively in request.data and extra', () => {
    const event = {
      request: { data: { email: 'a@b.com', password: 'Secret1', nested: { repeatPassword: 'Secret1', ok: 1 } } },
      extra: { payload: { password_hash: '$2b$12$x', keep: 'yes' }, list: [{ password: 'p' }] },
    }
    scrubSensitive(event)
    expect(event.request.data.password).toBe('[Filtered]')
    expect(event.request.data.email).toBe('a@b.com')
    expect((event.request.data.nested as Record<string, unknown>).repeatPassword).toBe('[Filtered]')
    expect((event.extra.payload as Record<string, unknown>).password_hash).toBe('[Filtered]')
    expect((event.extra.payload as Record<string, unknown>).keep).toBe('yes')
    expect((event.extra.list as Array<Record<string, unknown>>)[0].password).toBe('[Filtered]')
  })
  it('no-ops on an event without data/extra', () => {
    const event = {}
    expect(() => scrubSensitive(event)).not.toThrow()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run __tests__/utils/sentry-scrub.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Write the recursive scrubber util**

Create `utils/sentry/scrub.ts`:

```ts
const SENSITIVE = new Set(['password', 'repeatPassword', 'repeat_password', 'password_hash'])

function walk(node: unknown, seen: WeakSet<object>): void {
  if (!node || typeof node !== 'object') return
  if (seen.has(node as object)) return
  seen.add(node as object)
  if (Array.isArray(node)) {
    for (const item of node) walk(item, seen)
    return
  }
  const obj = node as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (SENSITIVE.has(key)) obj[key] = '[Filtered]'
    else walk(obj[key], seen)
  }
}

/**
 * Recursively replaces any password-family field with '[Filtered]' in a Sentry
 * event's request.data and extra. Wired into beforeSend AND
 * beforeSendTransaction in all three sentry configs.
 */
export function scrubSensitive(event: { request?: { data?: unknown }; extra?: Record<string, unknown> }): void {
  const seen = new WeakSet<object>()
  walk(event.request?.data, seen)
  walk(event.extra, seen)
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run __tests__/utils/sentry-scrub.test.ts`
Expected: PASS.

- [ ] **Step 9: Wire the scrubber into all three Sentry configs**

In each of `sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry.client.config.ts`:
- add `import { scrubSensitive } from '@/utils/sentry/scrub'` at the top;
- inside the existing `beforeSend(event)`, add `scrubSensitive(event)` before `return event`;
- add a `beforeSendTransaction(event) { scrubSensitive(event); return event }` property to the `Sentry.init({...})` object.

(The server config already has a `beforeSend` that strips headers — keep that and add the `scrubSensitive(event)` call there.)

- [ ] **Step 10: Wire the shared EMAIL_RE into login**

In `app/login/actions.ts`, remove the inline `EMAIL_RE` definition and add `import { EMAIL_RE } from '@/utils/auth/email'`. (This completes the spec's "share EMAIL_RE with signup"; the login/signup actions already reference `EMAIL_RE`.) Run the existing login tests to confirm no regression: `npx vitest run __tests__/actions/login.test.ts`.

- [ ] **Step 11: Fix the SignupForm minLength**

In `components/SignupForm.tsx`, change the password input's `minLength={6}` to `minLength={8}` (matches the 8-char server minimum; do not carry the stale value into the new flow).

- [ ] **Step 12: Run tests + build + lint + commit**

Run: `npx vitest run __tests__/api/purge-pending.test.ts __tests__/utils/sentry-scrub.test.ts`
Expected: PASS.
Run: `npm run test` (full suite green) → `npx tsc --noEmit` → `npm run build` → `npm run lint`
Expected: all pass.

```bash
git add app/api/cron/purge-pending/route.ts vercel.json utils/sentry/scrub.ts sentry.server.config.ts sentry.edge.config.ts sentry.client.config.ts app/login/actions.ts components/SignupForm.tsx __tests__/api/purge-pending.test.ts __tests__/utils/sentry-scrub.test.ts
git commit -m "feat(security): purge cron + recursive Sentry scrubber + shared EMAIL_RE + signup minLength"
```

---

## Operational (controller-run, after review)

- `bcryptjs` + `@types/bcryptjs` installed (Task 1) — verify in `package.json`.
- Apply both migrations to the production Supabase DB before deploy.
- After applying the pending_registrations migration, verify RLS manually: with the anon key, `select`/`insert` on `public.pending_registrations` must return zero rows / be rejected (no public access); only the service role can read/write. [MUST verify]
- Set `CRON_SECRET` in Vercel (production) and `.env.local` (32-byte hex).
- Confirm the Vercel cron is registered after deploy.
- Document `CRON_SECRET` in CLAUDE.md's env list.
- Verify in a real environment that GoTrue accepts the bcryptjs `$2b$12$` hash via `createUser({password_hash})` (create one real landing purchase in test mode with the admin cookie; confirm the account can log in with the typed password).

---

## Self-Review

**Spec coverage:**
- pending_registrations + profiles columns + RLS → Task 2. ✅
- bcrypt password at rest → Task 1 + used in Task 8 (hash) / Task 6 (createUser password_hash). ✅
- Shared validator (email/countries/fields, strength, age, terms) → Task 3. ✅
- Form 11 fields + no password rehydration + error copy → Task 9. ✅
- landingCheckout (validate, hash, pending, client_reference_id, per-email rate limit, generic existing-email) → Task 8. ✅
- Webhook pendingId branch (paid guard, no strict amount, idempotent) + session.expired → Task 7, provisioner Task 6. ✅
- Resolve-or-create, no overwrite of existing password/profile, strict op order → Task 6. ✅
- Confirmation email (new vs existing), last + gated + never throws → Task 5, called in Task 6. ✅
- Demo/prod guard → Task 4, wired in Task 8. ✅
- Purge cron + session.expired delete → Task 10 + Task 7. ✅
- Sentry scrubber + minLength fix → Task 10. ✅
- Rollout: keep legacy guest detector → Task 7 (pendingId branch precedes, legacy retained). ✅
- CRON_SECRET → Operational. ✅

**Placeholder scan:** none — every code step has full code. Migration task has no unit test by design (SQL applied manually), noted explicitly.

**Type consistency:** `hashPassword`, `EMAIL_RE`, `COUNTRIES`/`isValidCountry`, `validateRegistration`/`CleanRegistration`, `canProvisionInline`/`supabaseRefFromUrl`/`PROD_SUPABASE_REF`, `sendPurchaseConfirmation`, `provisionFromPending(session, admin, opts?)`, `scrubSensitive` signatures are identical across the tasks that define and consume them. `pendingId` carried in `client_reference_id` consistently in Task 8 (set), Task 6 (read), Task 7 (read). Provisioner returns `{ ok, userId, created }` used by Task 7's branch. Amount guard (`payment_status==='paid'` + valid `amount_total`, no strict equality) consistent between Global Constraints, Task 6, and the spec (updated).

**Hardening pass (adversarial verification of the plan):** applied before execution —
- Task 6: confirmation email now gated on a genuine `.select('id')` insert (fires exactly once; no email on duplicate delivery or already-owned 23505); `opts.isDemo` marks `user_metadata.is_demo` + `course_purchases.is_demo` so inline/prod test accounts are reapable by `cleanup_demo_data.sql`; 23505 emits a distinctive refund-candidate log; test double models the `.update().eq().is()` customer-id chain and the `.upsert().select()` shape with separate profile-column vs customer-id buckets.
- Task 8: dedupe of prior pending rows per email before insert; per-IP/day row cap; pending row deleted on guard-refusal AND handled inline failure; `{isDemo:true}` passed to the provisioner; inline result captured (redirect on `!ok`); safe `name`/`email` re-echo after validation error; test asserts the synthetic demo session carries no password/hash and the guard-refuse path deletes pending.
- Task 10: Sentry scrubber extracted to a tested, recursive `utils/sentry/scrub.ts`, wired into `beforeSend` AND `beforeSendTransaction` in all three configs; shared `EMAIL_RE` imported into `app/login/actions.ts` (verified byte-identical regex).
- Operational: added manual RLS verification of `pending_registrations` (no anon/authenticated access).
