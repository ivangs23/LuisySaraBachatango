# Admin Panel — Design Spec

**Date:** 2026-04-27
**Author:** Iván González
**Status:** Approved (ready for implementation plan)

## 1. Goal

The current `/dashboard` serves the same view (My Courses + suggestions) to every role: `member`, `premium`, and `admin`. Admins need a different surface — a back-office to manage students, see business metrics, moderate community content, and grade submissions.

We add a new `/admin` area with its own layout, sidebar navigation, and several dedicated sections. `/dashboard` stays untouched for student usage.

## 2. Non-Goals (v1)

- No audit log table for admin actions (post-v1).
- No automated daily metric snapshots (queries hit the live tables; fine for current scale).
- No flagging/reporting workflow in the community moderation view (small community, manual moderation is enough).
- No i18n for the admin UI — Spanish only (back-office for 1–2 admins).
- No E2E tests (project doesn't use Playwright yet).
- No data migrations: the existing schema covers everything.

## 3. Architecture

### 3.1 Routes

```
app/
  admin/
    layout.tsx              # role guard (admin only) + sidebar shell
    page.tsx                # overview: KPIs + lists + quick actions
    alumnos/
      page.tsx              # students list (search, filter, paginate)
      [id]/page.tsx         # student detail (5-tab right column)
      actions.ts            # role change, grant access, notify, delete
    estadisticas/
      page.tsx              # dedicated analytics (6 charts)
    entregas/
      page.tsx              # pending submissions queue
    cursos/
      page.tsx              # courses overview with per-course stats
    comunidad/
      page.tsx              # posts/comments moderation
components/admin/
  AdminSidebar.tsx
  AdminKpiCard.tsx
  AdminRevenueChart.tsx     # 'use client' Recharts
  AdminStatsCharts/         # one component per chart in /estadisticas
  StudentsTable.tsx
  StudentDetail/            # ficha + tabs
  ...
utils/admin/
  guard.ts                  # requireAdmin() helper
  queries.ts                # server-side fetchers (uses service role where needed)
  metrics.ts                # pure calculators (MRR, monthly groupings, etc.)
```

### 3.2 Reuse, not replace

The existing admin-edit routes stay where they are:

- `/courses/create`
- `/courses/[id]/edit`
- `/courses/[id]/add-lesson`
- `/courses/[courseId]/[lessonId]/submissions`

The `/admin` panel **links** to these. It does not move or duplicate them.

### 3.3 Coexistence with `/dashboard`

- `/dashboard` keeps its current student-facing layout for everyone, including admins.
- A subtle banner appears on `/dashboard` only for admins: *"Tienes acceso al panel de administración →"* linking to `/admin`.
- No automatic redirect — an admin sometimes wants to see what a student sees.

## 4. Layout & Navigation

### 4.1 `app/admin/layout.tsx`

Server Component. Three responsibilities:

1. `await supabase.auth.getUser()` → if no user, `redirect('/login')`.
2. Read `profiles.role` for the user → if not `'admin'`, `redirect('/dashboard')`.
3. Render the shell: `<AdminSidebar pendingSubmissions={N} />` + `<main>{children}</main>`.

While inside `/admin/*`, the global site header is replaced by the admin shell — entering "back-office mode."

The pending-submissions count for the sidebar badge is fetched here (cheap `count: 'exact', head: true`) and passed as a prop. No polling in v1.

### 4.2 `AdminSidebar` (Client Component)

- Fixed left column ~240px on desktop, collapsible to icon-rail (~64px), drawer with hamburger on mobile (<768px).
- Items (top to bottom):
  - **Inicio** → `/admin`
  - **Alumnos** → `/admin/alumnos`
  - **Estadísticas** → `/admin/estadisticas`
  - **Entregas** → `/admin/entregas` (badge with pending count)
  - **Cursos** → `/admin/cursos`
  - **Comunidad** → `/admin/comunidad`
- Footer:
  - "Volver al sitio" → `/dashboard`
  - Avatar + dropdown with logout
- Active item: thin lateral bar in `--primary` + subtle background; computed via `usePathname()` with prefix match (`/admin/alumnos/abc` activates "Alumnos").
- Styling: CSS Modules using existing variables (`--primary-rgb`, `--background`, `--text-main`). Coherent with the editorial style of the rest of the site, but denser and more functional. **No Tailwind, no Shadcn.**

## 5. Overview page — `/admin`

Vertical structure with four blocks. All data is fetched in `page.tsx` via a single `Promise.all`. Client islands are used only for charts.

### 5.1 Block A — Hero + KPI cards

Short editorial header (eyebrow "PANEL · ADMIN" + greeting) followed by a 6-card KPI grid (responsive: 6 → 3 → 2 → 1):

| KPI | Value | Sub-text | Source |
|---|---|---|---|
| Alumnos totales | `count(profiles)` | `+N esta semana` (`created_at > now()-7d`) | profiles |
| Suscripciones activas | `count(subscriptions WHERE status IN ('active','trialing'))` | `MRR ~ €X/mes` (sum normalized by `plan_type`) | subscriptions |
| Ingresos del mes | sum of current-month revenue | `vs €X mes anterior ↑/↓ Y%` | course_purchases + subscriptions |
| Cursos publicados | `count(courses WHERE is_published)` | `N lecciones` | courses, lessons |
| Entregas pendientes | `count(submissions WHERE status='pending')` | `Más antigua: hace Xd` | submissions |
| Alumnos nuevos esta semana | `count(profiles WHERE created_at > now()-7d)` | `+N hoy` | profiles |

Each card is `<AdminKpiCard label icon value sub />`. Lucide icons. Accent color is `--primary` for the value.

**MRR normalization** (`utils/admin/metrics.ts`):
- `1month` → price/1
- `6months` → price/6
- `1year` → price/12

Source of plan prices: `STRIPE_CONFIG` in `utils/stripe/config.ts`.

### 5.2 Block B — 30-day revenue trend chart

Recharts area chart, daily revenue = subscriptions + one-time purchases over the last 30 days. Toggle for 30d/90d above the chart. X = date, Y = €. Component: `<AdminRevenueChart range={'30d'|'90d'} data={...} />` (client component).

Data is preaggregated in `utils/admin/queries.ts#getRevenueTimeseries(rangeDays)` and returned ready for Recharts.

### 5.3 Block C — Three lists in a 3-column grid

Stack vertically on mobile.

1. **Últimos alumnos** — top 5 by `profiles.created_at desc`. Each row: avatar, name, truncated email, relative date. "Ver todos →" link.
2. **Últimas compras / suscripciones** — top 5 from `course_purchases` UNION `subscriptions` ordered by `created_at`. Each row: avatar + student + "compró Curso X" / "se suscribió a 6meses" + amount + relative date.
3. **Cursos más activos** — top 5 courses by `count(lesson_progress WHERE is_completed AND updated_at > now()-30d)`. Each row: thumbnail + title + aggregate completion bar.

### 5.4 Block D — Quick actions

Row of 4 large buttons:

- `+ Crear curso` → `/courses/create`
- `+ Crear lección` → modal selector → `/courses/[id]/add-lesson`
- `→ Ver alumnos` → `/admin/alumnos`
- `→ Entregas pendientes [N]` → `/admin/entregas`

## 6. Students — `/admin/alumnos`

### 6.1 List `/admin/alumnos/page.tsx`

Operational dense table (not card grid).

**Toolbar**
- Search input (debounced) — server-side `ilike '%q%'` over `full_name` and `email`.
- Filter: Rol (`Todos · member · premium · admin`).
- Filter: Suscripción (`Todas · Activa · Sin suscripción · Nuevos del mes`).
- All state lives in query string (`?q=&role=&sub=&page=&sort=`).

**Table columns**

| Avatar | Nombre | Email | Rol | Suscripción | Alta | Última actividad |

- Sortable by: alta, última actividad, nombre.
- Row click → `/admin/alumnos/[id]`.
- "Última actividad" = `max(updated_at)` across `lesson_progress` and `submissions`, falling back to `auth.users.last_sign_in_at`.
- Server-side pagination, **25 per page**, sized for tens-to-hundreds of students.

**Implementation**
- `utils/admin/queries.ts#listStudents({q, role, sub, page, sort})` returns `{ rows, total }`.
- Uses **service role** because:
  - `auth.users.last_sign_in_at` lives in the `auth` schema and isn't exposed via RLS to admins. (Email is already mirrored in `profiles.email` by the `handle_new_user` trigger, so we read it from there.)
  - We want a single query with joins across `profiles`, `subscriptions`, and `course_purchases` regardless of RLS boundaries.
- Single query with explicit joins, no N+1.

### 6.2 Detail `/admin/alumnos/[id]/page.tsx`

Two-column layout on desktop, stacked on mobile.

**Left column — student card**
- Avatar, full name, email, role, registration date, last sign-in.
- Subscription block: plan name, period (start → end), Stripe customer ID with link.
- Social links (existing fields in `profiles`).
- Admin actions:
  - `Cambiar rol ▾` (member / premium / admin)
  - `+ Conceder acceso a curso` (modal selector)
  - `✉ Enviar notificación` (modal: title + body)
  - `⚠ Eliminar alumno` (typed-confirm dialog: must type `ELIMINAR`)

**Right column — 5 tabs**
1. **Cursos** — accessible courses split into "Por compra" and "Por suscripción", each with progress bar.
2. **Progreso** — per-course expandable list of lessons with completion check + date.
3. **Entregas** — `submissions` history with status, grade, feedback. Link to grading page.
4. **Comunidad** — recent posts and comments (top 20). Inline delete (admin).
5. **Pagos** — chronological table merging subscriptions + course_purchases with amounts in €. Total spent at the bottom.

### 6.3 Server actions — `app/admin/alumnos/actions.ts`

Each action calls `requireAdmin()` first.

- `updateUserRole(userId, role)` — updates `profiles.role`, calls `revalidatePath('/admin/alumnos')`.
- `grantCourseAccess(userId, courseId)` — inserts into `course_purchases` with `stripe_session_id = 'manual_admin_<uuid>'` and `amount_paid = 0`. Idempotent via existing `UNIQUE(user_id, course_id)`.
- `sendNotification(userId, title, body)` — inserts into `notifications` with type `admin_message`.
- `deleteUser(userId)` — calls `supabase.auth.admin.deleteUser(userId)` (service role). Cascades clear `profiles`, `subscriptions`, etc.

## 7. Statistics — `/admin/estadisticas`

Dedicated analytics page with a global time-range filter (`30d · 90d · 1 año · Todo`) applied to all charts. Six chart blocks:

| # | Chart | Type | Data |
|---|---|---|---|
| ① | Ingresos por mes | Stacked bar | `course_purchases.amount_paid` + subscription revenue, `date_trunc('month')` |
| ② | Altas de alumnos por mes | Bar | `count(profiles) group by date_trunc('month', created_at)` |
| ③ | Suscripciones activas en el tiempo | Area | per-day count of subs covering that day |
| ④ | Top cursos | Horizontal bar | combined `count(course_purchases) + count(distinct user_id) from lesson_progress` per course |
| ⑤ | Distribución de planes | Donut | `count(*) group by plan_type WHERE status active` |
| ⑥ | Engagement: lecciones completadas/semana | Line | `count(lesson_progress WHERE is_completed) group by date_trunc('week', updated_at)` |

**Implementation**
- One `Promise.all` in `page.tsx` calling 6 fetchers in `metrics.ts`.
- Each fetcher returns data already shaped for Recharts (`[{x, y, ...}]`).
- `<AdminChart*>` components are pure `'use client'`, prop-driven, no internal state except range toggle.
- Activity ③ is computed in JS from raw subscription rows over the date range (simpler than SQL window functions for v1).

## 8. Secondary sections

### 8.1 `/admin/entregas`

Operational queue for grading. Two tabs: **Pendientes** (default) and **Revisadas**.

| Alumno | Curso · Lección | Enviada | Estado | |
|---|---|---|---|---|
| Juan Pérez | Junio 2025 · Bachata básica | hace 2d | 🟡 Pendiente | [Corregir →] |

"Corregir" links to the existing `/courses/[courseId]/[lessonId]/submissions` page (no UI duplication). The sidebar badge mirrors the pending count.

### 8.2 `/admin/cursos`

Summary view (does not replace `/courses/[id]/edit`). Card grid of all courses (published + drafts), each card showing:

- Thumbnail, title, type (`membership`/`complete`), publication state.
- Mini-stats: students with access, lesson count, average completion %, revenue generated.
- Actions: `Editar →` (`/courses/[id]/edit`) and `+ Lección` (`/courses/[id]/add-lesson`).

Prominent `+ Crear curso` button at the top → `/courses/create`.

### 8.3 `/admin/comunidad`

Moderation view, two tabs:

1. **Posts recientes** — table with author, first line, date, like/comment counts, and **Eliminar** action (with confirmation). Click row → original post.
2. **Comentarios recientes** — same but for `comments`.

No flagging/reporting in v1.

## 9. Security

- **Defense in depth.** The layout guard is the first line; every admin server action calls `requireAdmin()` again before mutating.
- **`utils/admin/guard.ts#requireAdmin()`** — reads the session, looks up `profiles.role`, throws if not admin. Use at the top of every server action and every service-role query function.
- **Service role usage** — restricted to `utils/admin/queries.ts` (and the delete-user action). Centralized in one module so it's easy to audit. Never exposed to client components.
- **No RLS changes needed.** Existing policies (`assignments_submissions.sql`, `course_purchases.sql`, `rbac_setup.sql`) already give admins read access to what we need. The only data only reachable via service role is `auth.users` (Supabase design).
- **Destructive confirmations**:
  - Delete user → typed-confirm (`ELIMINAR`).
  - Delete post / comment → modal confirmation with focus trap.
- **Sanitization** — admin-rendered URLs (Stripe customer link, social links on student card) go through existing `sanitizeUrl()` / `safeSocialUrl()` from `utils/sanitize.ts`.

## 10. Internationalization

Admin UI is **Spanish-only** in v1. Not in `utils/dictionaries.ts`. Strings are inline in components.

User-facing strings emitted by admin actions (e.g., notification body sent to a student) go through the regular i18n flow when the student reads them — that already exists.

## 11. Charting library

**Recharts** (`recharts` ~95kb, declarative React API). Tree-shaken; only the chart types we use are bundled. Each chart component is a thin client wrapper that receives data as props from a Server Component parent.

Add to `package.json`:
```
"recharts": "^2.x"
```

## 12. Testing

- **Vitest unit tests** for `utils/admin/metrics.ts`: MRR normalization, monthly grouping, plan-type distribution, revenue aggregation. Pure functions, no Supabase mock needed.
- **Server action tests** (mocking the Supabase client per `vitest.setup.ts`):
  - `requireAdmin()` rejects member / premium / unauthenticated; accepts admin.
  - Each mutating action (role change, grant access, notify, delete) — happy path + unauthorized path.
- **Component tests (jsdom)** — minimal: `StudentsTable` renders rows and click navigates.
- **No E2E** in v1.

## 13. Performance considerations

- All overview lists use `LIMIT 5`. Counts use `{ count: 'exact', head: true }` to avoid loading rows.
- Statistics page accepts the live-table cost as fine for current scale (tens-to-hundreds of students). If it grows past that, introduce a `daily_metrics_snapshot` table populated by a cron — **out of scope for v1**.
- Search on `/admin/alumnos` uses `ilike` with `%q%`. If list size grows past ~500, add a `pg_trgm` GIN index on `profiles(full_name)` and on `profiles.email` (the column is already mirrored in `profiles` per `schema.sql`, so we don't need to touch the `auth` schema).
- Charts are server-rendered with data; client only handles toggle interaction.

## 14. Delivery plan (suggested implementation order)

Each step is independently mergeable and leaves the panel functional, if incomplete:

1. Layout + sidebar + `requireAdmin()` guard (`app/admin/layout.tsx`, `AdminSidebar`, `utils/admin/guard.ts`).
2. Overview KPIs + blocks C/D (no chart yet — placeholder).
3. Recharts dependency + `<AdminRevenueChart>` for block B.
4. `/admin/alumnos` list (search, filters, pagination).
5. `/admin/alumnos/[id]` detail + admin actions (role, grant access, notify, delete).
6. `/admin/estadisticas` with the 6 charts.
7. `/admin/entregas`, `/admin/cursos`, `/admin/comunidad`.
8. Admin banner on `/dashboard`.

## 15. Open follow-ups (post-v1)

- Audit log for admin actions.
- Daily metric snapshots for analytics performance at scale.
- Community flagging/reporting workflow.
- E2E tests with Playwright.
- i18n for admin UI if more admins onboard.
