# E2E Tests (Playwright)

Smoke tests covering anonymous, authenticated, and admin flows across the main features of the platform.

## Spec files

| File | Scope | Requires env vars |
|---|---|---|
| `anonymous.spec.ts` | Home, courses list, community anon CTA, invalid login | — |
| `public-pages.spec.ts` | All public routes (events, music, blog, about, contact, legal, login, signup, forgot-password), language switcher, protected-route redirects | — |
| `auth-flows.spec.ts` | Signup form rendering, password-reset request, logout | `E2E_USER_*` for logout only |
| `auth.spec.ts` | Dashboard access, non-admin cannot add-lesson | `E2E_USER_*` |
| `user-flows.spec.ts` | Profile edit, dashboard, create post + comment, admin-route gating | `E2E_USER_*` |
| `admin.spec.ts` | Create lesson, tracks manager visibility | `E2E_ADMIN_*` |
| `admin-crud.spec.ts` | Create course (unpublished), edit course form state, submissions page access | `E2E_ADMIN_*` |

Tests that require env vars **skip** automatically when those vars are missing.

## Running

```bash
npm run test:e2e       # headless
npm run test:e2e:ui    # Playwright UI mode
```

The `webServer` in `playwright.config.ts` auto-spawns `npm run dev` at port 3000 and reuses a running server if one exists. Set `E2E_BASE_URL` to point at a deployed instance instead.

## Required environment variables

| Var | Purpose | Default behavior if missing |
|---|---|---|
| `E2E_BASE_URL` | Override target URL | Uses http://localhost:3000 + auto-spawn dev |
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` | A normal (non-admin) user | Auth tests skip |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | An admin user | Admin tests skip |
| `E2E_READY_LESSON_URL` | Path to `/courses/:cid/:lid/edit` for a lesson with Mux `ready` status | Tracks-manager test skips |

## Seeding test users

Create three accounts in Supabase Auth (Dashboard → Authentication → Users):
- `e2e-anon@test.local` — password of your choice (used for the invalid-login test indirectly)
- `e2e-user@test.local` — will be the non-admin user
- `e2e-admin@test.local` — will be the admin user

Then run in SQL editor:

```sql
update profiles set role = 'admin'   where id = (select id from auth.users where email = 'e2e-admin@test.local');
update profiles set role = 'premium' where id = (select id from auth.users where email = 'e2e-user@test.local');
```

Set the env vars in `.env.local` or export them before running:

```bash
export E2E_USER_EMAIL=e2e-user@test.local
export E2E_USER_PASSWORD=yourpassword
export E2E_ADMIN_EMAIL=e2e-admin@test.local
export E2E_ADMIN_PASSWORD=youradminpassword
npm run test:e2e
```

## Notes

- Tests are serial (`workers: 1`) to avoid auth race conditions.
- No real Mux upload is tested — that flow needs manual verification (see `docs/superpowers/plans/2026-04-23-mux-video-migration.md` Task 16).
- Stripe checkout is not tested here.
- Signup tests **do not** submit a real signup (avoids polluting `auth.users`); they only assert form rendering and client-side validation.
- Admin course-create tests leave unpublished courses behind (no delete UI/action exists). These never appear publicly.
- The `e2e/.auth/` directory (Playwright saved auth states) is git-ignored.
