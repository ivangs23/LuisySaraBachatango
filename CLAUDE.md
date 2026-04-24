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
| `lessons` | Belong to courses; `video_source` (`url`\|`upload`), `is_free`, `media_config` (multi-track video) |
| `subscriptions` | Synced from Stripe; `status` and period dates used for access gating |
| `course_purchases` | One-time purchase records; keyed by `stripe_session_id` for idempotency |
| `assignments` / `submissions` | Per-lesson assignments; admins grade submissions and trigger notifications |
| `lesson_progress` | Tracks completed lessons per user |
| `notifications` | In-app notifications (e.g., graded assignment) |
| `posts` / `comments` | Community forum |

SQL migration files are in `supabase/`. The canonical schema is `supabase/schema.sql` with additive patches in other files (e.g., `rbac_setup.sql`, `course_types.sql`).

### Security Utilities

`utils/sanitize.ts` provides `sanitizeUrl()` (validates HTTPS only) and `safeSocialUrl()`. Use these whenever rendering user-supplied URLs to prevent `javascript:` injection.

### Testing

Tests live in `__tests__/` with subfolders mirroring the source structure. Vitest runs in `node` environment by default; component tests use `jsdom` (configured via `environmentMatchGlobs` in [vitest.config.ts](vitest.config.ts)). Supabase and Stripe are mocked in `vitest.setup.ts`.

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
```
