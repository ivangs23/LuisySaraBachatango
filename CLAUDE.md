# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Luis y Sara Bachatango** is a Next.js 16 dance course platform (Bachata/Bachatango) with:
- Supabase for auth + database (PostgreSQL + RLS)
- Stripe for subscriptions and one-time course purchases
- Internationalization in 6 languages (es, en, fr, de, it, ja)
- CSS Modules for styling (no Tailwind, no Shadcn)

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all tests once
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

Run a single test file:
```bash
npx vitest run __tests__/actions/login.test.ts
```

## Architecture

### Auth & Access Control

Supabase handles auth. The middleware ([middleware.ts](middleware.ts) → [utils/supabase/middleware-helper.ts](utils/supabase/middleware-helper.ts)) refreshes sessions on every request and protects routes requiring login. There is no Next.js i18n routing — locale is stored in a cookie (`locale`) and `localStorage`.

**Three user roles** (in `profiles.role`): `member` | `premium` | `admin`. Admin role gates all content creation/editing. There is no separate admin panel — admin UI is embedded in the same routes (e.g., edit buttons appear conditionally).

### Content Access Model

Two course types control access:
- `membership` — accessible if user has an active subscription whose period covers the course's `month`/`year`
- `complete` — accessible via one-time purchase recorded in `course_purchases`

Videos are served by Mux. The `lessons` table stores a `mux_asset_id` + `mux_playback_id`. The lesson page (server component) checks access (admin, purchase, or subscription covering the course's month/year), then signs a short-lived JWT via `signPlaybackToken()` (`utils/mux/server.ts`) and passes it to `<MuxPlayer>`.

### Data Flow Pattern

All mutations go through **Next.js Server Actions** (`'use server'`). Pages are Server Components that fetch data directly via `createClient()` (server Supabase client). Client components use `'use client'` and receive data as props.

Two Supabase clients:
- `utils/supabase/server.ts` — uses user session (cookie-based), respects RLS
- Direct `createSupabaseAdmin()` calls with `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS, used in API routes and for admin operations like user deletion

### Internationalization

**Client-side**: `LanguageContext` wraps the app (in [app/layout.tsx](app/layout.tsx)), reads locale from `localStorage`/cookie, provides the `useLanguage()` hook and `t` translation object.

**Server-side**: `getDict()` ([utils/get-dict.ts](utils/get-dict.ts)) reads the `locale` cookie server-side. Use this in Server Components and Server Actions.

All translations live in `utils/dictionaries.ts` as a single typed object with keys for all 6 locales.

### Stripe Integration

- `/api/checkout` — creates Checkout Sessions (subscription or one-time course purchase)
- `/api/webhooks/stripe` — handles `checkout.session.completed`, `customer.subscription.updated/deleted`; writes to `subscriptions` and `course_purchases` tables
- `profile/actions.ts#verifyStripeSession` — alternative verification path used after redirect back from Stripe

`STRIPE_CONFIG` in [utils/stripe/config.ts](utils/stripe/config.ts) holds subscription price IDs. Currency is always EUR.

### Key Database Tables

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`; holds `role`, `stripe_customer_id`, social links |
| `courses` | Course metadata; `course_type` (`membership`\|`complete`), `month`/`year` for subscription matching |
| `events` | Public agenda; localized `title`/`description` JSONB (es/en/fr/de/it/ja), `start_date`/`end_date`, `is_published` |
| `lessons` | Belong to courses; `video_source` (`url`\|`upload`), `is_free`, `media_config` (multi-track video) |
| `subscriptions` | Synced from Stripe; `status` and period dates used for access gating |
| `course_purchases` | One-time purchase records; keyed by `stripe_session_id` for idempotency |
| `assignments` / `submissions` | Per-lesson assignments; admins grade submissions and trigger notifications |
| `lesson_progress` | Tracks completed lessons per user |
| `notifications` | In-app notifications (e.g., graded assignment) |
| `posts` / `comments` | Community forum |

SQL migration files are in `supabase/`. The canonical schema is `supabase/schema.sql` with additive patches in other files (e.g., `rbac_setup.sql`, `course_types.sql`). **See [supabase/MIGRATIONS.md](supabase/MIGRATIONS.md) for the apply order and which legacy files are dangerous to re-run** — some (`rbac_setup.sql`, `events.sql`, `full_setup.sql`) reopen hardened policies if replayed over a hardened DB.

### Security Utilities

`utils/sanitize.ts` provides `sanitizeUrl()` (validates HTTPS only) and `safeSocialUrl()`. Use these whenever rendering user-supplied URLs to prevent `javascript:` injection.

### Testing

Tests live in `__tests__/` with subfolders mirroring the source structure. Vitest runs in `node` environment by default; component tests opt into `jsdom` via a `// @vitest-environment jsdom` docblock at the top of each file (the old `environmentMatchGlobs` config was removed in Vitest 4). Supabase and Stripe are mocked in `vitest.setup.ts`. Coverage: `@vitest/coverage-v8` is a dev dependency; run `npm run test:coverage`.

CI runs lint + `tsc --noEmit` + vitest + build on every push/PR (`.github/workflows/ci.yml`).

## Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # Required for admin ops and user deletion
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_BASE_URL           # Used for password reset redirect URL
MUX_TOKEN_ID                   # Mux Access Token (Settings → Access Tokens)
MUX_TOKEN_SECRET               # Mux Access Token secret
MUX_SIGNING_KEY_ID             # Mux Signing Key ID (Settings → Signing Keys), used for playback JWTs
MUX_SIGNING_KEY_PRIVATE        # Base64-encoded PEM of the Mux signing private key
TEST_MODE_SECRET               # Optional. HMAC key for the admin per-browser test-mode cookie (/admin/pruebas). Fail-closed: if unset, the test-mode toggle is inert and checkout always uses real Stripe.
CRON_SECRET                    # Bearer token for the scheduled purge route (/api/cron/purge-pending, Vercel cron). Fail-closed: if unset, the route returns 401 and stale pending_registrations are never purged.
RESEND_API_KEY                 # Resend API key; sender/domain for transactional emails (guest access, purchase confirmation). If unset, those emails silently no-op.
NEXT_PUBLIC_GA_MEASUREMENT_ID  # Optional. GA4 measurement ID (G-XXXXXXXXXX). Fail-closed: if unset, GA4 never loads even with analytics consent granted.
NEXT_PUBLIC_META_PIXEL_ID      # Optional. Numeric Meta Pixel ID. Fail-closed: if unset, the Pixel never loads even with marketing consent granted.
NEWSLETTER_UNSUBSCRIBE_SECRET  # HMAC key for newsletter unsubscribe links. Fail-closed: if unset, the welcome email is not sent (it could not carry a compliant unsubscribe link) and /unsubscribe rejects every token. Rotating it invalidates all outstanding links.
LANDING_ANALYTICS_SECRET       # HMAC key for the daily visitor-hash salt used by /api/landing-event. Fail-closed: if unset, no landing events are recorded and the route still returns 204. Rotating it breaks unique-visitor continuity for that day.
```

## Cookie Consent

`ConsentProvider` ([context/ConsentContext.tsx](context/ConsentContext.tsx)) holds two opt-in categories, both denied by default, in the `ls_consent` cookie:

| Category | Gates |
|---|---|
| `analytics` | GA4 |
| `marketing` | Meta Pixel, Instagram embeds |

Anything that drops third-party cookies **must** go through `useConsent()` — see [components/ThirdPartyScripts.tsx](components/ThirdPartyScripts.tsx) for the pattern. Vercel Analytics and Speed Insights are deliberately outside the gate: no cookies, no consent needed.

Bump `CONSENT_VERSION` in [utils/consent/categories.ts](utils/consent/categories.ts) whenever a category or provider is added — old consent does not cover new processing, so the banner must re-prompt. Adding a provider also means updating the CSP in [next.config.ts](next.config.ts).
