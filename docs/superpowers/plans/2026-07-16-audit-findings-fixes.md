# Audit Findings Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the whole-app audit findings (1 critical, 3 high, 11 medium, batched low) in severity order.

**Architecture:** DB findings are additive Supabase migration files in `supabase/` (the operator applies them; the tightened write-grants match what the app already does via the user-session client, so they're safe to apply independently of any code deploy). Code findings are edits to existing server actions / route handlers / components, each with a Vitest test where the logic is unit-testable, or a build/manual-verify step where it isn't (SQL grants, server-component render).

**Tech Stack:** Next.js 16 (App Router, server actions, route handlers), Supabase (RLS + grants, service-role admin client), Stripe, Vitest. Existing utilities to reuse: `rateLimit`/`rateLimitKey` (`utils/rate-limit.ts`), `requireAdmin` (`utils/auth/require-admin.ts`), `sanitizeUrl` (`utils/sanitize.ts`), `createSupabaseAdmin` (`utils/supabase/admin.ts`), `hasCourseAccess` (`utils/auth/course-access.ts`), `getCurrentLocale` (`utils/get-locale.ts` / `utils/get-dict.ts`).

## Global Constraints

- Requirements source: `docs/superpowers/specs/2026-07-16-security-audit-findings.md`.
- SQL migration files follow the repo convention: additive, dated `supabase/2026_07_<name>.sql`, idempotent (`drop policy if exists` before `create policy`; `create index if not exists`; column grants). NEVER edit the applied earlier migrations; add new ones.
- Migration-before-deploy: the write-tightening migrations (C1, H1, M1) restrict columns/writes the app never performs via the user-session client (the profile form writes only whitelisted columns; posts/comments/likes already set `user_id = auth.uid()`; the app never writes `grade` from a user session). They are safe to apply immediately and independently. Verify each live (anon/authenticated cannot escalate role, spoof user_id, or write grade) after applying.
- Test-mode/demo provisioning must never mint access against the production Supabase ref without the admin cookie (reuse `canProvisionInline`).
- Branch: `fix/audit-findings`.
- Commands: `npx vitest run <file>` (one file), `npm run test` (all), `npx tsc --noEmit`, `npm run build`, `npm run lint`.
- SQL tasks have no unit test (Supabase is mocked in Vitest); their "verify" step is the migration file's review + a documented live REST check. Do NOT fake a passing unit test for a grant/RLS change.

---

## File Structure

New files:
- `supabase/2026_07_profiles_role_lockdown.sql` (C1)
- `supabase/2026_07_ugc_insert_user_id.sql` (H1)
- `supabase/2026_07_submissions_grade_lockdown.sql` (M1)
- `supabase/2026_07_missing_indexes.sql` (M8)
- `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` (M9)
- `components/AppHeader.tsx` (M11, the Suspense-wrapped header island) — or inline Suspense in layout
- Tests: `__tests__/actions/submit-assignment.test.ts`, `__tests__/api/checkout-web.test.ts` (extend), `__tests__/api/lessons-next.test.ts`, `__tests__/actions/add-comment-ratelimit.test.ts`, `__tests__/admin/update-user-role.test.ts`, `__tests__/admin/delete-user-audit.test.ts`, `__tests__/api/sitemap.test.ts`

Modified:
- `app/courses/actions.ts` (H2), `context/LanguageContext.tsx` + `app/layout.tsx` (H3), `app/api/checkout/route.ts` (M2), `app/courses/[courseId]/[lessonId]/page.tsx` (M3), `app/api/lessons/next/route.ts` (M4), `app/actions/comments.ts` (M5), `app/admin/alumnos/actions.ts` (M6, M7), `app/sitemap.ts` (M10), `app/layout.tsx` (M11), plus LOW-batch files.

---

### Task 1: C1 — Lock down `profiles` writes (block role self-escalation) [CRITICAL]

**Files:**
- Create: `supabase/2026_07_profiles_role_lockdown.sql`

No unit test (grant/RLS change). Verified by SQL review + live REST check after the operator applies it.

- [ ] **Step 1: Write the migration**

Create `supabase/2026_07_profiles_role_lockdown.sql`:

```sql
-- CRITICAL: the profiles UPDATE RLS policy is `using (auth.uid() = id)` with no
-- WITH CHECK and no column restriction, and Supabase's default table-level
-- UPDATE grant to `authenticated` covers ALL columns — so any logged-in user can
-- PATCH their own row setting role='admin' via the public anon key and become a
-- full admin. Fix with column-level grants (mirrors the SELECT lock-down model):
-- revoke the blanket UPDATE, then grant UPDATE only on the columns the profile
-- form legitimately writes. `role`, `email`, `stripe_customer_id`, `id`, and the
-- consent/terms columns are intentionally excluded — they are written only by the
-- service role (admin ops, webhook provisioner), which bypasses grants.
revoke update on public.profiles from anon, authenticated;
grant update (
  full_name, avatar_url, updated_at,
  instagram, facebook, tiktok, youtube,
  country, city, postal_code, date_of_birth, phone, dance_level, marketing_consent
) on public.profiles to authenticated;
```

- [ ] **Step 2: Verify the column set matches what the app writes via the user client**

Run: `grep -rn "from('profiles').update\|from(\"profiles\").update" app components utils | grep -v node_modules`
Confirm every user-session (`createClient`, NOT `createSupabaseAdmin`) profiles UPDATE only touches columns in the grant list above (expected: `app/profile/actions.ts` writes full_name/avatar_url/social links). Service-role updates (admin role change, provisioner) are unaffected by column grants. If a user-session update writes a column NOT in the list, add that column to the grant (but NEVER `role`/`email`/`stripe_customer_id`).

- [ ] **Step 3: Commit**

```bash
git add supabase/2026_07_profiles_role_lockdown.sql
git commit -m "fix(security): revoke blanket profiles UPDATE grant, block role self-escalation"
```

- [ ] **Step 4: Live verification (operator, after apply)**

After applying to Supabase, with the anon key + a normal user's JWT:
`PATCH /rest/v1/profiles?id=eq.<own-uid>` body `{"role":"admin"}` → must return 403 `permission denied for column role` (or the update must not change role). `PATCH ... {"full_name":"X"}` → still succeeds. Record the result.

---

### Task 2: H1 — Bind `user_id = auth.uid()` on UGC INSERT policies [HIGH]

**Files:**
- Create: `supabase/2026_07_ugc_insert_user_id.sql`

No unit test. SQL review + live REST check.

- [ ] **Step 1: Write the migration**

Create `supabase/2026_07_ugc_insert_user_id.sql`:

```sql
-- HIGH: posts / comments / comment_likes INSERT policies check only
-- `auth.role() = 'authenticated'`, never binding the row's user_id to auth.uid().
-- A user can insert rows with ANOTHER member's user_id via direct PostgREST,
-- spoofing authorship / forging likes. Recreate each policy to bind the owner.
-- (RLS policies for the same command are OR'd, so the permissive policy must be
-- dropped, not merely supplemented.)

-- posts
drop policy if exists "Authenticated users can create posts." on public.posts;
create policy "Authenticated users can create posts." on public.posts
  for insert with check ((select auth.uid()) = user_id);

-- comments (community post comments AND lesson comments live in the same table)
drop policy if exists "Authenticated users can create comments." on public.comments;
create policy "Authenticated users can create comments." on public.comments
  for insert with check ((select auth.uid()) = user_id);

-- comment_likes
drop policy if exists "Users can like comments." on public.comment_likes;
create policy "Users can like comments." on public.comment_likes
  for insert with check ((select auth.uid()) = user_id);
```

NOTE for the implementer: the exact policy NAMES above must match the ones in `supabase/community_setup.sql` and `supabase/comments_setup.sql`. Before writing, `grep -n "for insert" supabase/community_setup.sql supabase/comments_setup.sql` and copy the real policy names into the `drop policy if exists` lines (a wrong name makes the drop a no-op and leaves the permissive policy live).

- [ ] **Step 2: Confirm the app always sets user_id = auth.uid()**

Run: `grep -rn "from('posts').insert\|from('comments').insert\|from('comment_likes').insert" app`
Confirm each sets `user_id: user.id` from the authed session (expected in `app/community/actions.ts`, `app/actions/comments.ts`, `app/actions/community-likes.ts`) — so the tightened policy doesn't break the happy path.

- [ ] **Step 3: Commit**

```bash
git add supabase/2026_07_ugc_insert_user_id.sql
git commit -m "fix(security): bind user_id=auth.uid() on posts/comments/comment_likes insert RLS"
```

- [ ] **Step 4: Live verification (operator)** — with user A's JWT, `POST /rest/v1/comments` body with `user_id` = user B's uuid → must be rejected; with `user_id` = A's own uuid → succeeds.

---

### Task 3: H2 — Validate `fileUrl` in `submitAssignment` (stored-XSS → admin takeover) [HIGH]

**Files:**
- Modify: `app/courses/actions.ts` (`submitAssignment`, ~line 333)
- Test: `__tests__/actions/submit-assignment.test.ts`

**Interfaces:**
- Consumes: `sanitizeUrl(value): string | null` from `@/utils/sanitize` (HTTPS-only allowlist, returns null for `javascript:`/non-https).

- [ ] **Step 1: Write the failing test**

Create `__tests__/actions/submit-assignment.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockAssignmentSingle, mockUpsert, mockHasAccess } = vi.hoisted(() => ({
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
  mockAssignmentSingle: vi.fn().mockResolvedValue({ data: { lesson_id: 'l1', lessons: { course_id: 'c1' } } }),
  mockUpsert: vi.fn().mockResolvedValue({ error: null }),
  mockHasAccess: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: (t: string) => t === 'assignments'
      ? { select: () => ({ eq: () => ({ single: mockAssignmentSingle }) }) }
      : { upsert: mockUpsert },
  }),
}))
vi.mock('@/utils/auth/course-access', () => ({ hasCourseAccess: (...a: unknown[]) => mockHasAccess(...a) }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT:' + u) } }))

import { submitAssignment } from '@/app/courses/actions'
beforeEach(() => vi.clearAllMocks())

describe('submitAssignment fileUrl validation', () => {
  it('rejects a javascript: fileUrl (no DB write)', async () => {
    const res = await submitAssignment('a1', 'texto', "javascript:alert(document.cookie)")
    expect(res).toEqual({ error: 'invalid_file' })
    expect(mockUpsert).not.toHaveBeenCalled()
  })
  it('rejects a non-https http: fileUrl', async () => {
    const res = await submitAssignment('a1', 'texto', 'http://evil/x')
    expect(res).toEqual({ error: 'invalid_file' })
    expect(mockUpsert).not.toHaveBeenCalled()
  })
  it('accepts null fileUrl (text-only submission)', async () => {
    const res = await submitAssignment('a1', 'texto', null)
    expect(res).toEqual({ success: true })
    expect(mockUpsert.mock.calls[0][0].file_url).toBe(null)
  })
  it('accepts an https fileUrl and stores it', async () => {
    const res = await submitAssignment('a1', '', 'https://storage.example.com/f.pdf')
    expect(res).toEqual({ success: true })
    expect(mockUpsert.mock.calls[0][0].file_url).toBe('https://storage.example.com/f.pdf')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/actions/submit-assignment.test.ts`
Expected: FAIL — a `javascript:` fileUrl is currently stored (no validation), so the reject cases fail.

- [ ] **Step 3: Add the validation**

In `app/courses/actions.ts`, add the import at the top if missing:
```ts
import { sanitizeUrl } from '@/utils/sanitize'
```
In `submitAssignment`, after the `hasCourseAccess` check and BEFORE the `.upsert(...)`, insert:
```ts
  // fileUrl is member-supplied and later rendered as an <a href> on the admin
  // submissions page — reject anything that isn't a safe https URL to prevent a
  // stored javascript:-scheme XSS that would execute as the reviewing admin.
  let safeFileUrl: string | null = null
  if (fileUrl != null && fileUrl !== '') {
    safeFileUrl = sanitizeUrl(fileUrl)
    if (!safeFileUrl) return { error: 'invalid_file' }
  }
```
and change the upsert payload `file_url: fileUrl,` to `file_url: safeFileUrl,`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/actions/submit-assignment.test.ts`
Expected: PASS.

- [ ] **Step 5: Defense-in-depth at render**

In `app/courses/[courseId]/[lessonId]/submissions/page.tsx` (~line 162), wrap the href: change `href={sub.file_url}` to `href={sanitizeUrl(sub.file_url) ?? '#'}` and add `import { sanitizeUrl } from '@/utils/sanitize'` if missing. Run `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add app/courses/actions.ts app/courses/[courseId]/[lessonId]/submissions/page.tsx __tests__/actions/submit-assignment.test.ts
git commit -m "fix(security): validate submitAssignment fileUrl (block stored javascript: XSS)"
```

---

### Task 4: H3 — Seed i18n locale from the cookie (fix hydration mismatch) [HIGH]

**Files:**
- Modify: `context/LanguageContext.tsx`, `app/layout.tsx`
- Test: `__tests__/components/language-provider.test.tsx`

**Interfaces:**
- Produces: `LanguageProvider` now accepts `initialLocale?: Locale`.
- Consumes: `getCurrentLocale()` (server) from `@/utils/get-locale` (or wherever the cookie locale reader lives — confirm the export name with `grep -rn "export .*getCurrentLocale\|export .*getLocale" utils`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/language-provider.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { LanguageProvider, useLanguage } from '@/context/LanguageContext'

function Probe() { const { locale } = useLanguage(); return <span data-testid="loc">{locale}</span> }

describe('LanguageProvider initialLocale', () => {
  it('uses the server-provided initialLocale on first render (no localStorage read)', () => {
    const { getByTestId } = render(<LanguageProvider initialLocale="en"><Probe /></LanguageProvider>)
    expect(getByTestId('loc').textContent).toBe('en')
  })
  it('defaults to es when no initialLocale given', () => {
    const { getByTestId } = render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(getByTestId('loc').textContent).toBe('es')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/language-provider.test.tsx`
Expected: FAIL — `LanguageProvider` doesn't accept `initialLocale`; first test gets `es`.

- [ ] **Step 3: Accept `initialLocale`**

In `context/LanguageContext.tsx`, change the signature + initial state:
```tsx
export function LanguageProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (initialLocale && ['es', 'en', 'fr', 'de', 'it', 'ja'].includes(initialLocale)) return initialLocale;
    if (typeof window === 'undefined') return 'es';
    const saved = localStorage.getItem('language') as Locale | null;
    if (saved && ['es', 'en', 'fr', 'de', 'it', 'ja'].includes(saved)) return saved;
    return 'es';
  });
```
(Keep the rest — `changeLocale`, the cookie write, `router.refresh()` — unchanged.)

- [ ] **Step 4: Pass the cookie locale from the server layout**

In `app/layout.tsx`, the root layout already reads `const locale = await getCurrentLocale();`. Pass it to the provider: change `<LanguageProvider>` to `<LanguageProvider initialLocale={locale}>`. (If the provider is nested elsewhere, thread `locale` down.) Confirm `getCurrentLocale()` returns a `Locale`; if it returns a plain string, cast to `Locale`.

- [ ] **Step 5: Run test + typecheck + commit**

Run: `npx vitest run __tests__/components/language-provider.test.tsx` → PASS. `npx tsc --noEmit` → clean.
```bash
git add context/LanguageContext.tsx app/layout.tsx __tests__/components/language-provider.test.tsx
git commit -m "fix(i18n): seed locale from server cookie to remove hydration mismatch"
```

---

### Task 5: M1 — Lock down `submissions` grade/feedback/status writes [MEDIUM]

**Files:**
- Create: `supabase/2026_07_submissions_grade_lockdown.sql`

No unit test. SQL review + live check.

- [ ] **Step 1: Write the migration**

Create `supabase/2026_07_submissions_grade_lockdown.sql`:

```sql
-- MEDIUM: the submissions UPDATE policy (auth.uid()=user_id AND status='pending')
-- has no column scope, so a student can set their own grade/feedback on a pending
-- submission via direct PostgREST. Revoke UPDATE on the graded columns; students
-- only need to edit their own text/file before review (those are set via upsert).
-- Grading is done by the service role (admin) which bypasses grants.
revoke update (grade, feedback, status) on public.submissions from authenticated;
```

NOTE: this leaves `authenticated` able to UPDATE the other submission columns (text_content, file_url, updated_at). If the repo prefers a strict whitelist, instead `revoke update on public.submissions from authenticated;` then `grant update (text_content, file_url, updated_at) on public.submissions to authenticated;`. Pick the revoke-specific form above (minimal change) unless the reviewer prefers whitelist.

- [ ] **Step 2: Commit + live verify**

```bash
git add supabase/2026_07_submissions_grade_lockdown.sql
git commit -m "fix(security): revoke student UPDATE on submissions grade/feedback/status"
```
Operator: with a student JWT, `PATCH /rest/v1/submissions?id=eq.<own>` body `{"grade":10}` → rejected; `{"text_content":"x"}` on a pending row → still allowed.

---

### Task 6: M2 — Add the prod-safety guard to the web checkout demo branch [MEDIUM]

**Files:**
- Modify: `app/api/checkout/route.ts` (demo branch, ~line 54)
- Test: `__tests__/api/checkout.test.ts` (extend the existing file)

**Interfaces:**
- Consumes: `canProvisionInline({ triggeredByAdminCookie, supabaseUrl })` from `@/utils/checkout/demo-provision-guard`; `readTestCookie()` from `@/utils/demo/test-mode`.

- [ ] **Step 1: Write the failing test (extend the existing checkout test)**

Add to `__tests__/api/checkout.test.ts` — first ensure the mocks include the guard + cookie. Add near the other `vi.mock`s:
```ts
vi.mock('@/utils/demo/test-mode', () => ({ isTestPurchaseMode: () => mockIsTestPurchaseMode(), readTestCookie: vi.fn().mockResolvedValue(false) }))
vi.mock('@/utils/checkout/demo-provision-guard', () => ({ canProvisionInline: (...a: unknown[]) => mockCanProvision(...a) }))
```
add `mockCanProvision: vi.fn().mockReturnValue(true)` to the hoisted mocks, and a test:
```ts
it('demo branch refused by prod guard -> 403, no purchase upsert', async () => {
  mockIsTestPurchaseMode.mockResolvedValue(true)
  mockCanProvision.mockReturnValue(false)
  const res = await POST(post({ courseId: 'c1' }))
  expect(res.status).toBe(403)
  expect(mockUpsert).not.toHaveBeenCalled()
})
```
(If the existing test file's mock/hoist structure differs, adapt names to match it — read it first.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/checkout.test.ts`
Expected: FAIL — no guard yet; demo branch proceeds regardless.

- [ ] **Step 3: Add the guard**

In `app/api/checkout/route.ts`, add imports:
```ts
import { readTestCookie } from '@/utils/demo/test-mode';
import { canProvisionInline } from '@/utils/checkout/demo-provision-guard';
```
Inside `if (await isTestPurchaseMode()) {`, before the demo upsert, insert:
```ts
      const triggeredByAdminCookie = await readTestCookie();
      if (!canProvisionInline({ triggeredByAdminCookie, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL })) {
        return NextResponse.json({ error: 'Demo checkout no permitido en este entorno.' }, { status: 403 });
      }
```

- [ ] **Step 4: Run test + commit**

Run: `npx vitest run __tests__/api/checkout.test.ts` → PASS.
```bash
git add app/api/checkout/route.ts __tests__/api/checkout.test.ts
git commit -m "fix(security): gate web checkout demo branch behind prod-safety guard"
```

---

### Task 7: M3 — Honor `is_free` in the lesson access/token gate [MEDIUM]

**Files:**
- Modify: `app/courses/[courseId]/[lessonId]/page.tsx` (~lines 50-113)

Server component; verified by build + reading the diff (no isolated unit test). The change is a boolean gate.

- [ ] **Step 1: Select `is_free`**

In the lesson query (~line 50-54), add `is_free` to the `.select(...)` column list for the lesson row.

- [ ] **Step 2: OR it into the playback gate**

Find where `hasAccess`/`canPlay` are computed (~line 107, 113): they are `isAdmin || !!coursePurchase || !!coveringSubscription`. Add `lesson.is_free` to the boolean that gates PLAYBACK / Mux token signing:
```ts
  const canPlay = isAdmin || lesson.is_free || !!coursePurchase || !!coveringSubscription;
```
Keep any separate boolean that gates paywalled description/assignment tabs unchanged if those should remain paid-only; if there's a single `hasAccess` used for everything, OR `is_free` into it (a free preview lesson is fully accessible).

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` → clean. `npm run build` → compiles.
```bash
git add app/courses/[courseId]/[lessonId]/page.tsx
git commit -m "fix(content): honor is_free so free-preview lessons unlock playback"
```

---

### Task 8: M4 — `/api/lessons/next`: filter published + access [MEDIUM]

**Files:**
- Modify: `app/api/lessons/next/route.ts`
- Test: `__tests__/api/lessons-next.test.ts`

**Interfaces:**
- Consumes: `hasCourseAccess(userId, courseId)` from `@/utils/auth/course-access`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/lessons-next.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const { mockGetUser, mockLessonSingle, mockHasAccess } = vi.hoisted(() => ({
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
  mockLessonSingle: vi.fn(),
  mockHasAccess: vi.fn(),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ order: () => ({ limit: () => ({ maybeSingle: mockLessonSingle }) }) }) }) }) }) }),
  }),
}))
vi.mock('@/utils/auth/course-access', () => ({ hasCourseAccess: (...a: unknown[]) => mockHasAccess(...a) }))
import { GET } from '@/app/api/lessons/next/route'
beforeEach(() => vi.clearAllMocks())

describe('GET /api/lessons/next', () => {
  it('401 when logged out', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect((await GET()).status).toBe(401)
  })
  it('returns null when the lesson course is not accessible', async () => {
    mockLessonSingle.mockResolvedValue({ data: { id: 'l1', course_id: 'c1', is_free: false }, error: null })
    mockHasAccess.mockResolvedValue(false)
    const res = await GET(); expect(await res.json()).toBe(null)
  })
  it('returns the lesson when accessible', async () => {
    mockLessonSingle.mockResolvedValue({ data: { id: 'l1', course_id: 'c1', is_free: false, title: 'X' }, error: null })
    mockHasAccess.mockResolvedValue(true)
    const res = await GET(); expect((await res.json()).id).toBe('l1')
  })
  it('returns a free lesson without an access check', async () => {
    mockLessonSingle.mockResolvedValue({ data: { id: 'l2', course_id: 'c1', is_free: true, title: 'Y' }, error: null })
    mockHasAccess.mockResolvedValue(false)
    const res = await GET(); expect((await res.json()).id).toBe('l2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/lessons-next.test.ts`
Expected: FAIL — route returns the lesson regardless of access; the `hasCourseAccess` import doesn't exist yet, and `.eq('is_published', ...)` chain differs.

- [ ] **Step 3: Add the published filter + access check**

Rewrite `app/api/lessons/next/route.ts`:
```ts
import { createClient } from '@/utils/supabase/server';
import { hasCourseAccess } from '@/utils/auth/course-access';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const now = new Date();
  const threeDaysAgo = new Date(); threeDaysAgo.setDate(now.getDate() - 3);
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('id, title, order, release_date, course_id, thumbnail_url, is_free, courses!inner(is_published)')
    .eq('courses.is_published', true)
    .gte('release_date', threeDaysAgo.toISOString())
    .lte('release_date', next24Hours.toISOString())
    .order('release_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !lesson) return NextResponse.json(null);
  if (!lesson.is_free && !(await hasCourseAccess(user.id, lesson.course_id))) {
    return NextResponse.json(null);
  }
  return NextResponse.json(lesson);
}
```
NOTE: the test's mock models the pre-published-filter chain; if adding `.eq('courses.is_published', true)` changes the chain shape the test double must match, align the test double's chained methods with the final query. Keep the four assertions.

- [ ] **Step 4: Run test + commit**

Run: `npx vitest run __tests__/api/lessons-next.test.ts` → PASS.
```bash
git add app/api/lessons/next/route.ts __tests__/api/lessons-next.test.ts
git commit -m "fix(content): /api/lessons/next filters published + course access"
```

---

### Task 9: M5 — Rate-limit `addComment` [MEDIUM]

**Files:**
- Modify: `app/actions/comments.ts` (`addComment`, ~line 107)
- Test: `__tests__/actions/add-comment-ratelimit.test.ts`

**Interfaces:**
- Consumes: `rateLimit(key, max, windowMs)`, `rateLimitKey(parts)` from `@/utils/rate-limit`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/actions/add-comment-ratelimit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const { mockGetUser, mockRateLimit, mockHasAccess } = vi.hoisted(() => ({
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
  mockRateLimit: vi.fn().mockResolvedValue({ ok: true }),
  mockHasAccess: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/utils/supabase/server', () => ({ createClient: vi.fn().mockResolvedValue({
  auth: { getUser: mockGetUser },
  from: () => ({ select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { lesson_id: 'l1', lessons: { course_id: 'c1' } } }) }) }), insert: vi.fn().mockResolvedValue({ error: null }) }),
}) }))
vi.mock('@/utils/rate-limit', () => ({ rateLimit: (...a: unknown[]) => mockRateLimit(...a), rateLimitKey: (p: unknown[]) => p.join(':') }))
vi.mock('@/utils/auth/course-access', () => ({ hasCourseAccess: (...a: unknown[]) => mockHasAccess(...a) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { addComment } from '@/app/actions/comments'
beforeEach(() => vi.clearAllMocks())

describe('addComment rate limiting', () => {
  it('is rate-limited (returns error, no insert) when the limiter denies', async () => {
    mockRateLimit.mockResolvedValueOnce({ ok: false })
    const res = await addComment('l1', 'hola')
    expect(res).toEqual(expect.objectContaining({ error: expect.any(String) }))
    expect(mockRateLimit).toHaveBeenCalled()
  })
})
```
(Adapt `addComment`'s real signature + return shape — read `app/actions/comments.ts:107` first; the test must call it exactly as defined and assert its real rate-limited return value.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/actions/add-comment-ratelimit.test.ts`
Expected: FAIL — `addComment` never calls `rateLimit`.

- [ ] **Step 3: Add the rate limit**

In `app/actions/comments.ts`, `addComment`, after resolving `user` and before the DB insert, mirror `toggleLike`/`submitComment`:
```ts
  const rl = await rateLimit(rateLimitKey([user.id, 'lesson-comment']), 10, 60_000);
  if (!rl.ok) return { error: 'rate_limited' };
```
Add `import { rateLimit, rateLimitKey } from '@/utils/rate-limit'` if missing. Match the exact return-shape the function uses elsewhere (e.g. `{ error: '...' }`).

- [ ] **Step 4: Run test + commit**

Run: `npx vitest run __tests__/actions/add-comment-ratelimit.test.ts` → PASS.
```bash
git add app/actions/comments.ts __tests__/actions/add-comment-ratelimit.test.ts
git commit -m "fix: rate-limit addComment (10/min per user)"
```

---

### Task 10: M6 — Role-change guardrails [MEDIUM]

**Files:**
- Modify: `app/admin/alumnos/actions.ts` (`updateUserRole`, ~line 10)
- Test: `__tests__/admin/update-user-role.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/admin/update-user-role.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
const { mockRequireAdmin, mockUpdate, mockCount } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn().mockResolvedValue({ id: 'admin1' }),
  mockUpdate: vi.fn().mockResolvedValue({ error: null }),
  mockCount: vi.fn().mockResolvedValue({ count: 2 }),
}))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => mockRequireAdmin() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({
  from: () => ({
    update: () => ({ eq: mockUpdate }),
    select: () => ({ eq: () => mockCount }),
  }),
}) }))
import { updateUserRole } from '@/app/admin/alumnos/actions'
beforeEach(() => { vi.clearAllMocks(); mockRequireAdmin.mockResolvedValue({ id: 'admin1' }); mockCount.mockResolvedValue({ count: 2 }) })

describe('updateUserRole guardrails', () => {
  it('blocks changing your OWN role', async () => {
    await expect(updateUserRole('admin1', 'member')).rejects.toThrow()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
  it('blocks demoting the LAST admin', async () => {
    mockCount.mockResolvedValue({ count: 1 })
    await expect(updateUserRole('other-admin', 'member')).rejects.toThrow()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
  it('allows a normal role change', async () => {
    await updateUserRole('u2', 'premium')
    expect(mockUpdate).toHaveBeenCalled()
  })
})
```
(Read the real `updateUserRole` + `createSupabaseAdmin` chain first and align the mock's chain shape — the count query is `from('profiles').select('id',{count:'exact',head:true}).eq('role','admin')`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/admin/update-user-role.test.ts`
Expected: FAIL — no self-block, no last-admin guard.

- [ ] **Step 3: Add the guards**

In `updateUserRole` (`app/admin/alumnos/actions.ts`), after `await requireAdmin()` (capture the return) and the enum/id validation, before the update:
```ts
  const me = await requireAdmin();
  ...
  if (userId === me.id) throw new Error('No puedes cambiar tu propio rol');
  if (role !== 'admin') {
    // Demoting away from admin: make sure it isn't the last one.
    const { data: current } = await sb.from('profiles').select('role').eq('id', userId).single();
    if (current?.role === 'admin') {
      const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
      if ((count ?? 0) <= 1) throw new Error('No puedes quitar el último admin');
    }
  }
```
(Adjust `requireAdmin()` capture — the function currently calls it without capturing `me`; capture it. `sb` is the existing `createSupabaseAdmin()` client.)

- [ ] **Step 4: Run test + commit**

Run: `npx vitest run __tests__/admin/update-user-role.test.ts` → PASS.
```bash
git add app/admin/alumnos/actions.ts __tests__/admin/update-user-role.test.ts
git commit -m "fix(admin): guard role changes (no self-change, no last-admin demotion)"
```

---

### Task 11: M7 — Audit trail for admin `deleteUser` [MEDIUM]

**Files:**
- Modify: `app/admin/alumnos/actions.ts` (`deleteUser`, ~line 55)
- Test: `__tests__/admin/delete-user-audit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/admin/delete-user-audit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'
const { mockRequireAdmin, mockProfileSingle, mockAuditInsert, mockDeleteUser } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn().mockResolvedValue({ id: 'admin1' }),
  mockProfileSingle: vi.fn().mockResolvedValue({ data: { id: 'u2', email: 'x@y.com' }, error: null }),
  mockAuditInsert: vi.fn().mockResolvedValue({ error: null }),
  mockDeleteUser: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => mockRequireAdmin() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({
  from: (t: string) => t === 'account_deletions'
    ? { insert: mockAuditInsert }
    : { select: () => ({ eq: () => ({ single: mockProfileSingle }) }) },
  auth: { admin: { deleteUser: mockDeleteUser } },
}) }))
import { deleteUser } from '@/app/admin/alumnos/actions'
beforeEach(() => vi.clearAllMocks())

describe('deleteUser audit trail', () => {
  it('writes a hashed-email audit row before deleting', async () => {
    await deleteUser('u2', 'ELIMINAR', 'x@y.com')
    expect(mockAuditInsert).toHaveBeenCalled()
    const row = mockAuditInsert.mock.calls[0][0]
    expect(row.email_sha256).toBe(crypto.createHash('sha256').update('x@y.com').digest('hex'))
    expect(mockDeleteUser).toHaveBeenCalledWith('u2')
  })
})
```
(Confirm the exact hashing the repo uses in `deleteAccount` — match it: `crypto.createHash('sha256').update(<normalizedEmail>).digest('hex')`. Use the SAME normalization, `email.trim().toLowerCase()`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/admin/delete-user-audit.test.ts`
Expected: FAIL — `deleteUser` never writes `account_deletions`.

- [ ] **Step 3: Add the audit write**

In `deleteUser` (`app/admin/alumnos/actions.ts`), after the email match check and BEFORE `sb.auth.admin.deleteUser(userId)`, insert (mirror `deleteAccount` in `app/profile/actions.ts`):
```ts
  try {
    const emailHash = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    await sb.from('account_deletions').insert({ email_sha256: emailHash });
  } catch (err) {
    console.error('[admin deleteUser] audit insert failed', err);
  }
```
Add `import crypto from 'node:crypto'` if missing. (If `account_deletions` has an actor column, also record `me.id`; otherwise the email hash matches the self-delete schema.)

- [ ] **Step 4: Run test + commit**

Run: `npx vitest run __tests__/admin/delete-user-audit.test.ts` → PASS.
```bash
git add app/admin/alumnos/actions.ts __tests__/admin/delete-user-audit.test.ts
git commit -m "fix(admin): write account_deletions audit row on admin deleteUser"
```

---

### Task 12: M8 — Missing indexes [MEDIUM]

**Files:**
- Create: `supabase/2026_07_missing_indexes.sql`

No unit test. SQL review.

- [ ] **Step 1: Write the migration**

Create `supabase/2026_07_missing_indexes.sql`:

```sql
-- Hot lookup columns without an index -> seq scans as tables grow.
create index if not exists comment_likes_comment_id_idx on public.comment_likes (comment_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id);
create index if not exists assignments_lesson_id_idx on public.assignments (lesson_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/2026_07_missing_indexes.sql
git commit -m "perf(db): index comment_likes.comment_id, comments.parent_id, assignments.lesson_id"
```

---

### Task 13: M9 — Error / not-found / global-error boundaries [MEDIUM]

**Files:**
- Create: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`

No unit test; verified by build. These are UI fallbacks.

- [ ] **Step 1: Create `app/not-found.tsx`**

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Página no encontrada</h1>
        <p style={{ opacity: 0.75, marginBottom: '1rem' }}>Lo sentimos, no encontramos lo que buscabas.</p>
        <Link href="/" style={{ textDecoration: 'underline' }}>Volver al inicio</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create `app/error.tsx`** (client component — route segment error boundary)

```tsx
'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Algo salió mal</h1>
        <p style={{ opacity: 0.75, marginBottom: '1rem' }}>Ha ocurrido un error. Inténtalo de nuevo.</p>
        <button onClick={reset} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Reintentar</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `app/global-error.tsx`** (catches errors in the root layout itself; must render its own html/body)

```tsx
'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'sans-serif', minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '2rem' }}>
        <div>
          <h1>Algo salió mal</h1>
          <button onClick={reset} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Reintentar</button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Build + commit**

Run: `npx tsc --noEmit && npm run build` → compiles.
```bash
git add app/error.tsx app/global-error.tsx app/not-found.tsx
git commit -m "feat(reliability): add error, global-error and not-found boundaries"
```

---

### Task 14: M10 — Sitemap: read community posts with the service role [MEDIUM]

**Files:**
- Modify: `app/sitemap.ts` (~lines 65-76)

**Interfaces:**
- Consumes: `createSupabaseAdmin()` from `@/utils/supabase/admin` (service role, bypasses the `authenticated`-only posts RLS).

- [ ] **Step 1: Switch the posts query to the service-role client**

In `app/sitemap.ts`, the posts section uses the anon/user client which returns 0 rows (posts RLS requires `authenticated`). Replace that specific query's client with `createSupabaseAdmin()` (read-only, only selects public `id`/`slug`/`updated_at`). Add `import { createSupabaseAdmin } from '@/utils/supabase/admin'`. Only the posts read changes; keep courses/static routes as-is.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` → clean. `npm run build` → compiles (sitemap route builds).
```bash
git add app/sitemap.ts
git commit -m "fix(seo): read community posts with service role so they reach the sitemap"
```

---

### Task 15: M11 — Stream the personalized header so static pages stay static [MEDIUM]

**Files:**
- Modify: `app/layout.tsx`

Verified by build (check that static routes are no longer forced dynamic). No unit test.

- [ ] **Step 1: Move the cookie-reading header into a Suspense island**

In `app/layout.tsx`, the root layout awaits `getCurrentUser()` + `getCachedProfile()` directly, which opts the whole tree dynamic. Extract the user/profile-dependent header into an async child component rendered inside `<Suspense fallback={<HeaderSkeleton/>}>`, so the root layout itself no longer awaits per-request data for the whole subtree. Keep `getCurrentLocale()` if it's needed for `<html lang>` (that read is cheap but still opts dynamic — acceptable, or read locale in the header island too and default `lang="es"` on the html). Minimal version: wrap `<Header user={user} profile={profile} />` in a `<Suspense>` with the fetch inside an async `AppHeader` server component.
```tsx
// components/AppHeader.tsx (server component)
import { getCurrentUser } from '@/utils/get-user'; // match the repo's actual export
import { getCachedProfile } from '@/app/layout-helpers'; // or inline as in layout today
import Header from '@/components/Header';
export default async function AppHeader() {
  const user = await getCurrentUser();
  const profile = user ? await getCachedProfile(user.id) : null;
  return <Header user={user} profile={profile} />;
}
```
and in `app/layout.tsx` render `<Suspense fallback={null}><AppHeader /></Suspense>` instead of awaiting user/profile at the top.

NOTE: this is the most nuanced task. If extracting cleanly risks regressions (the layout also uses `user` for the JSON-LD or `DemoBanner`/`FunnelLegalFooter` gating), keep those reads but move ONLY the header's user/profile fetch into the island. If the reviewer judges the refactor too invasive for the perf gain, it may be deferred — flag it rather than force a fragile change.

- [ ] **Step 2: Build + commit**

Run: `npx tsc --noEmit && npm run build`. In the build output, confirm previously-dynamic static routes (`/blog`, `/music`, `/sobre-nosotros`, `/legal/*`) now render as static (○) rather than dynamic (ƒ) if the extraction succeeded; if they're still dynamic because `getCurrentLocale()` remains in the layout, note it.
```bash
git add app/layout.tsx components/AppHeader.tsx
git commit -m "perf: stream personalized header so static pages render statically"
```

---

### Task 16: LOW / polish batch [LOW]

**Files:** multiple (each a small, independent edit). One commit per logical group is fine.

No new tests required beyond the existing suite staying green; verified by `npm run test` + `npm run build` + `npm run lint` at the end.

- [ ] **Step 1: Reuse the shared `requireAdmin`** in `app/courses/mux-actions.ts` — delete the local `requireAdmin` (lines ~14-21) and `import { requireAdmin } from '@/utils/auth/require-admin'`; replace its error-return usage with the throwing guard (wrap call sites to match, or keep a thin local adapter if many sites depend on the `{error}` shape — minimal: import and call `await requireAdmin()` at the top of each exported action, remove the local copy).
- [ ] **Step 2: Escape PostgREST `.or()` filter** in `utils/admin/queries.ts:305-311` — also escape `,` `(` `)` `.` in the search term (extend the existing `replace(/[%_]/g, ...)` to `replace(/[%_,().\\]/g, m => '\\' + m)`), or build the OR via the supported argument form.
- [ ] **Step 3: SSRF allowlist** in `app/courses/mux-actions.ts` `addMuxTextTrack` — before `fetch(fileUrl)`, assert `new URL(fileUrl).origin` matches the expected Mux/storage host; reject otherwise.
- [ ] **Step 4: Pin `search_path`** on the events trigger function — new migration `supabase/2026_07_events_trigger_search_path.sql`: `create or replace function public.set_events_updated_at() ... language plpgsql set search_path = public as $$ ... $$;` (copy the existing body from `supabase/events.sql`).
- [ ] **Step 5: Scope `comment_likes` SELECT** to authenticated — same migration or a new one: `drop policy if exists <name> on public.comment_likes; create policy ... for select using (auth.role() = 'authenticated');` (copy the real policy name from `comments_setup.sql`).
- [ ] **Step 6: Delete dead code** — `components/NextClassPopup.tsx`, `components/AddLessonForm.tsx`, `components/LessonAssignmentTab.tsx` (confirm zero importers with `grep -rn` first).
- [ ] **Step 7: Define or replace `--bg-secondary`** — add it to `:root` in `app/globals.css` (pick a value consistent with the theme) or replace its two usages.
- [ ] **Step 8: Dedup LOCALES** — export the canonical list from `utils/i18n/types.ts` and import it in `LanguageContext.tsx`, `utils/get-locale.ts`, `app/events/_lib/parse.ts`, `components/EventForm.tsx`.
- [ ] **Step 9: Fix `NEXT_PUBLIC_BASE_URL` fallback** in `app/login/actions.ts:84` — use the prod-domain fallback (or throw) instead of `localhost:3000`, matching the rest of the codebase.
- [ ] **Step 10: Duplicate `<main>`** — change `components/AuthShell.tsx:122` `<main>` to `<div>`.
- [ ] **Step 11: `verifyStripeSession` ownership** — in `app/profile/actions.ts`, either delete the unused function or add `if (session.metadata?.userId !== user.id) return { success: false }` before returning success.
- [ ] **Step 12: Full suite + build + lint + commit**

Run: `npm run test` (green), `npx tsc --noEmit`, `npm run build`, `npm run lint`.
```bash
git add -A
git commit -m "chore(cleanup): shared requireAdmin, filter escaping, dead code, css var, locale dedup, misc audit lows"
```

---

## Operational (after merge)

Apply these Supabase migrations (order within the group doesn't matter; all safe to apply immediately, independent of the code deploy):
- `2026_07_profiles_role_lockdown.sql` (C1 — URGENT, closes the live admin-escalation hole)
- `2026_07_ugc_insert_user_id.sql` (H1)
- `2026_07_submissions_grade_lockdown.sql` (M1)
- `2026_07_missing_indexes.sql` (M8)
- `2026_07_events_trigger_search_path.sql` + comment_likes SELECT scope (LOW batch)

Then deploy the code. Live-verify C1/H1/M1 per each task's verification step.

Consider folding C1 + the `handle_new_user` hardening + the profiles UPDATE fix back into the canonical `schema.sql`/`full_setup.sql` so a fresh DB init doesn't regress (LOW finding — separate follow-up).

---

## Self-Review

**Spec coverage:** C1→T1, H1→T2, H2→T3, H3→T4, M1→T5, M2→T6, M3→T7, M4→T8, M5→T9, M6→T10, M7→T11, M8→T12, M9→T13, M10→T14, M11→T15, all LOW→T16. Every finding has a task. ✅

**Placeholder scan:** SQL/UI/refactor tasks that can't carry a Vitest unit test (T1,T2,T5,T7,T12,T13,T14,T15) say so explicitly and give a concrete verify (SQL review + live REST check, or build). Not placeholders — the correct verification for that change type. Code tasks (T3,T4,T6,T8,T9,T10,T11) have full failing tests + implementations. T2/T9/T10/T11 note "read the real names/signatures first and align the mock" because exact policy names / action signatures must be confirmed against the live files — this is a real instruction, not a TODO.

**Type/interface consistency:** `sanitizeUrl`, `rateLimit`/`rateLimitKey`, `requireAdmin`, `createSupabaseAdmin`, `hasCourseAccess`, `canProvisionInline`/`readTestCookie`, `getCurrentLocale`, `LanguageProvider(initialLocale)` are referenced consistently with their existing/added signatures. Migration file names are unique and dated. The `deleteUser` audit uses the same `email_sha256` hashing as the existing `deleteAccount`.
