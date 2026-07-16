# Whole-app audit findings (2026-07-16)

Source: 7 parallel review agents (auth, payments, content/Mux, community/UGC, admin, DB/RLS, frontend). This is the requirements source for the fix plan.

## CRITICAL

**C1 — Privilege escalation: any authenticated user self-promotes to `admin`.**
`supabase/schema.sql:19-20` (dup `full_setup.sql`): `profiles` UPDATE policy is `for update using (auth.uid() = id)` — no `WITH CHECK`, no column restriction. The two PII lockdown migrations touched SELECT grants only; the Supabase default table-level UPDATE grant to `authenticated` (all columns incl. `role`) is intact. Exploit: `PATCH /rest/v1/profiles?id=eq.<own-uid>` body `{"role":"admin"}` with anon key + own JWT → passes RLS → admin → total compromise + free access to all courses/lessons/Mux. Live-exploitable in prod.
Fix: `revoke update on public.profiles from anon, authenticated;` then `grant update (<editable non-privileged cols>) on public.profiles to authenticated;` (exclude role, email, stripe_customer_id, id, terms_*, amount fields). Regression test: a member cannot set role='admin' on their own row.

## HIGH

**H1 — Authorship spoofing: posts/comments/comment_likes INSERT policies don't bind `user_id`.**
`supabase/community_setup.sql:17-18` (posts), `:42-43` (post comments); `supabase/comments_setup.sql:20-21` (lesson comments), `:44-46` (comment_likes): all `with check (auth.role() = 'authenticated')` — never `user_id = auth.uid()`. A user inserts rows with another member's/admin's UUID via direct PostgREST → content/likes attributed to the victim; also bypasses the lesson-comment course-access check + app rate limits. `post_likes` already does it right (`notifications_v2.sql:39`).
Fix: drop + recreate each INSERT policy with `with check (auth.uid() = user_id)`; for lesson comments optionally fold in the course-access EXISTS predicate.

**H2 — Stored XSS via `submitAssignment` fileUrl → admin account takeover.**
`app/courses/actions.ts:333` (`submitAssignment`) stores `fileUrl` with no validation (no sanitizeUrl). Rendered unescaped as `<a href={sub.file_url}>` on the admin-only `app/courses/[courseId]/[lessonId]/submissions/page.tsx:162`. CSP allows inline; a `javascript:` href runs as admin on click. Any member with access to one assignment can plant it.
Fix: validate fileUrl server-side in `submitAssignment` (require https or the expected storage prefix; reuse sanitizeUrl allowlist). Defense-in-depth: sanitize `sub.file_url` again at render. Test: a `javascript:`/non-https fileUrl is rejected.

**H3 — i18n hydration mismatch on every non-Spanish load.**
`context/LanguageContext.tsx:16-24`: client locale seeded from `localStorage` only; server + SSR default to `'es'` → server/client output mismatch for any saved non-`es` locale across ~12 components. No suppressHydrationWarning/mount-guard.
Fix: pass the server-read `locale` cookie (`getCurrentLocale()`) into `LanguageProvider` as the initial locale prop instead of trusting localStorage on first render.

## MEDIUM

**M1 — Students can write their own submission `grade`/`feedback`.**
`supabase/assignments_submissions.sql:55-56`: `FOR UPDATE USING (auth.uid()=user_id AND status='pending')`, `WITH CHECK` defaults to USING, no column scope. Student can set grade/feedback/file_url on own pending submission. Fix: `revoke update (grade, feedback, status) on public.submissions from authenticated;` (or column-whitelist grant of editable cols).

**M2 — `/api/checkout` demo branch lacks the prod-safety guard.**
`app/api/checkout/route.ts:54-65`: demo path gates only on `isTestPurchaseMode()`, then upserts a real `course_purchases` row (is_demo). The landing flow wraps the equivalent in `canProvisionInline()`. A preview/dev deploy inheriting prod Supabase creds could mint free access in prod. Fix: add `canProvisionInline({ triggeredByAdminCookie: await readTestCookie(), supabaseUrl })` before the demo upsert.

**M3 — `is_free` not honored by the lesson access/token gate.**
`app/courses/[courseId]/[lessonId]/page.tsx:50-54,107,113`: never selects `is_free`; `canPlay` = admin || purchase || subscription. Lessons marked free never unlock (fails closed). Fix: select `is_free` and OR it into the boolean gating `canPlay`/Mux token signing (keep separate from paywalled description/assignment tabs if desired).

**M4 — `/api/lessons/next` leaks lesson metadata regardless of access/publish.**
`app/api/lessons/next/route.ts:18-25`: only checks logged-in, returns lesson title/thumbnail/course_id with no `courses.is_published` join and no `hasCourseAccess`/`is_free` check → leaks upcoming/paid/draft lesson titles. Fix: join courses, filter is_published, return only if `hasCourseAccess(user.id, course_id)` or `is_free`, else null.

**M5 — App-layer rate limits bypassable + `addComment` unthrottled.**
Rate limits on posts/comments/likes live only in server actions; the same tables are insertable via direct PostgREST (see H1) → floodable. `app/actions/comments.ts:107-181` (`addComment`) has no `rateLimit()` at all (unlike `toggleLike`/`submitComment`). Fix: add `rateLimit()` to `addComment`; add DB-level length CHECK constraints + a per-user insert-velocity trigger (or accept app-layer once H1 closes the direct-insert authorship gap — velocity still open).

**M6 — Role-change guardrails missing.**
`app/admin/alumnos/actions.ts:10-20` (`updateUserRole`): no self-demotion block, no last-admin guard, no confirmation. Fix: block self role-change, guard `count(role='admin')>1` before demoting an admin, typed confirmation for promotion to admin.

**M7 — Admin `deleteUser` has no audit trail.**
`app/admin/alumnos/actions.ts:55-80`: unlike self `deleteAccount`, it never writes `account_deletions`. Fix: insert email-hash + acting-admin id into `account_deletions` before `auth.admin.deleteUser`.

**M8 — Missing indexes.** `comment_likes(comment_id)`, `comments(parent_id)`, `assignments(lesson_id)` → seq scans. Fix: add the three indexes.

**M9 — No error/loading/not-found boundaries anywhere in `app/`.** Bad params / failures → blank unstyled screen; layout failures uncaught. Fix: add root `error.tsx` + `global-error.tsx` + `not-found.tsx`, plus `loading.tsx`/`not-found.tsx` for the main dynamic segments (courses, community, events, blog).

**M10 — Sitemap silently drops all community posts.**
`app/sitemap.ts:65-76`: anon client + posts RLS `authenticated` → 0 rows, swallowed. Fix: use the service-role client for sitemap generation (read-only, public ids only).

**M11 — Root layout forces the whole app dynamic.**
`app/layout.tsx:95-98`: `getCurrentUser()`/`getCurrentLocale()` (cookies) in the root layout opt the whole subtree out of static rendering. Fix: stream the personalized header (user/profile) in a Suspense island so static pages (blog, music, sobre-nosotros, legal, contact) can be statically generated.

## LOW / polish (batch)

- verifyStripeSession no ownership check (inert today) — verify `session.metadata.userId === user.id` or delete.
- `role` in the anon SELECT allowlist (admin-enumeration recon) — drop from public grant; server reads via service role.
- Canonical `schema.sql`/`full_setup.sql` still recreate the permissive profiles UPDATE policy + unsafe `handle_new_user` — fold hardening back into canonical schema so re-running doesn't regress C1.
- PostgREST `.or()` filter injection in `utils/admin/queries.ts:305-311` (admin-only) — escape `,()`.` or use supported multi-arg form.
- SSRF in `addMuxTextTrack` `fetch(fileUrl)` (admin-only) — origin allowlist.
- `app/courses/mux-actions.ts:14-21` local `requireAdmin` — import shared guard.
- notifications UPDATE lets self-rewrite content (self-only) — narrow to is_read RPC.
- `comment_likes` SELECT world-readable — scope to authenticated.
- `events.sql:24-30` trigger mutable search_path — pin `set search_path = public`.
- ~20 hardcoded/untranslated strings + hardcoded aria-labels — route through dictionaries.
- No hreflang / URL locale — multilingual SEO gap (UX-only decision).
- Inconsistent a11y widgets (LanguageSwitcher, NotificationBell panel, comment like/reply buttons, ProfileForm/CoursesClient tabs, mobile nav drawer no focus-trap/Escape) — extract shared Disclosure/Menu/Tabs primitives.
- Duplicate `<main>` in `AuthShell.tsx:122` — use `<div>`.
- Data-fetching waterfalls (`app/community/[id]/page.tsx:66-106`, `app/events/page.tsx:31-41`) — Promise.all.
- Duplicate course query per request (`app/courses/[courseId]/page.tsx:14-20,42-47`) — React `cache()`.
- `NEXT_PUBLIC_BASE_URL` fallback inconsistent (localhost in `app/login/actions.ts:84`) + `assertProdEnv()` only wired to the webhook — centralize + wire per docs.
- Dead code: `components/NextClassPopup.tsx`, `AddLessonForm.tsx`, `LessonAssignmentTab.tsx` — delete or wire.
- `utils/admin/plan-prices.ts:3` €0 TODO placeholder — real prices.
- CSS var `--bg-secondary` used but undefined — define or replace.
- Duplicate LOCALES lists in 4 files — import from `utils/i18n/types.ts`.

## Migration/deploy ordering note

DB fixes (C1, H1, M1, M8, and low SQL items) are Supabase migrations the operator applies. Order matters: apply the RLS/grant migrations BEFORE deploying any code that would break under the tighter grants — but C1/H1/M1 tighten writes the app never does via the user client (profile form writes only the whitelisted columns; posts/comments already set user_id=auth.uid()), so they are safe to apply immediately and independently of the code deploy. Verify each live (anon/authenticated cannot escalate role, cannot spoof user_id, cannot write grade).
