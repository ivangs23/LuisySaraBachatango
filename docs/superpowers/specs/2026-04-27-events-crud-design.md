# Events CRUD — Design

**Status:** Approved (design phase)
**Date:** 2026-04-27

## Goal

Replace the hardcoded events list in `t.events.items` (4 events embedded in `utils/dictionaries.ts`) with a full CRUD managed by admins, persisted in Supabase. The public `/events` page renders from the database; admins can create, edit and delete events both from a new `/admin/eventos` section and via inline buttons on the public page.

## Decisions

- **Localization:** title and description stored localized for all 6 site locales (`es`, `en`, `fr`, `de`, `it`, `ja`).
- **Dates:** real `DATE` columns (`start_date`, `end_date`); month names are derived per-locale via `Intl.DateTimeFormat` (no manual `MONTH_LOOKUP`).
- **Extra fields:** only `is_published` (no cover image, no external URL).
- **Admin UI:** dedicated `/admin/eventos` section + inline edit/delete/create buttons rendered on `/events` for admins.
- **Location field:** plain text, not localized (current strings like "Madrid, España" or "Online" are acceptable in any locale).

Out of scope: event categories, RSVPs, ticket links, cover images, ICS export, recurring events, time-of-day fields.

## Data model

New table `events` in Supabase. Localized text lives in JSONB columns (no separate translations table — 6 known locales make this simpler and lets `/events` load with a single query).

```sql
create table events (
  id            uuid primary key default gen_random_uuid(),
  start_date    date not null,
  end_date      date not null,
  location      text not null,
  title         jsonb not null,   -- { es, en, fr, de, it, ja } — strings, "" allowed except es
  description   jsonb not null,   -- same shape
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint events_dates_chk check (end_date >= start_date)
);

create index events_start_date_idx on events (start_date);

-- updated_at trigger using existing project pattern (see other tables)
```

### RLS

```sql
alter table events enable row level security;

-- Public read: only published events
create policy "events_public_read"
  on events for select
  using (is_published = true);

-- Admins read all (drafts + published)
create policy "events_admin_read_all"
  on events for select
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- Admin writes
create policy "events_admin_write"
  on events for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
```

Migration file lives at `supabase/events.sql` (additive patch, following the project convention of one `.sql` per concern).

## Server Actions

New file `app/events/actions.ts` (`'use server'`). Three actions, mirroring `app/courses/actions.ts` style:

- `createEvent(formData: FormData)`
- `updateEvent(id: string, formData: FormData)`
- `deleteEvent(id: string)`

Each action:

1. `await requireAdmin()` (`utils/admin/guard.ts`); on failure return `{ error: 'unauthorized' }`.
2. Read from FormData:
   - `start_date`, `end_date` (parsed as ISO `YYYY-MM-DD`)
   - `location`
   - `is_published` (`'on'` → true)
   - 12 fields: `title_es`, `title_en`, …, `title_ja`, `description_es`, …, `description_ja`. Compose into the two JSONB objects.
3. Server validation:
   - `start_date` and `end_date` parseable; `end_date >= start_date`.
   - `location` trimmed, non-empty.
   - `title.es` and `description.es` trimmed, non-empty.
   - Other locales optional (saved as `""` if empty).
4. Insert/update/delete via the user-scoped `createClient()` (RLS enforces admin).
5. `revalidatePath('/events')` and `revalidatePath('/admin/eventos')`.
6. `createEvent` and `updateEvent` redirect to `/admin/eventos`; `deleteEvent` does not redirect (called from the public page or the admin list, the calling form decides).

## Public page (`/events`)

Split current `app/events/page.tsx` into:

### `app/events/page.tsx` — Server Component

- Calls `createClient()` and checks admin status without throwing: query `profiles.role` for the current user (`null` if anonymous). Computes `isAdmin = role === 'admin'`. Does **not** call `requireAdmin()` because the page must remain public.
- Fetches events:
  - Admin: `select * from events order by start_date asc`
  - Non-admin / anon: relies on RLS — same query returns only published.
- Reads `locale` cookie via `getDict()` is not needed here — we pass the raw events plus the `isAdmin` flag to `<EventsClient>` and let the client component resolve the active locale via `useLanguage()`.

### `components/EventsClient.tsx` — Client Component

Owns the JSX and animations from today's `app/events/page.tsx`. Differences:

- Receives `events: Event[]` and `isAdmin: boolean` as props.
- `Event` type:
  ```ts
  type Event = {
    id: string;
    start_date: string; // ISO
    end_date: string;
    location: string;
    title: Record<Locale, string>;
    description: Record<Locale, string>;
    is_published: boolean;
  };
  ```
- Uses `useLanguage()` for the active locale; resolves localized text with `event.title[locale] || event.title.es`.
- Replaces `parseEventDate(string)` with `derivePresentation(start_date, end_date, locale)` returning `{ monthLabel, startDay, endDay, year, endDate }`. `monthLabel` uses `new Intl.DateTimeFormat(locale, { month: 'short' }).format(start).toUpperCase()`.
- Drops the `MONTH_LOOKUP` constant.
- Upcoming/past split: compares `end_date` (end-of-day UTC) with `Date.now()`.
- When `isAdmin`:
  - Hero shows a **"+ Nuevo evento"** link to `/events/create`.
  - Each `<article>` gets two small floating buttons in the top-right corner: **Editar** (link) and **Borrar** (form posting to a wrapper that calls `deleteEvent`, gated by `confirm(t.events.deleteConfirm)`).
  - Drafts (`is_published === false`) render with a "Borrador" badge and reduced opacity. Drafts only appear at all because admins are the only ones who fetch them.

## Admin pages

### Sidebar

Edit `components/admin/AdminSidebar.tsx`:

```ts
{ href: '/admin/eventos', label: 'Eventos', Icon: CalendarDays }
```

Insert between "Cursos" and "Comunidad". Import `CalendarDays` from `lucide-react`.

### `app/admin/eventos/page.tsx` — Server Component

- Lists all events ordered by `start_date desc`.
- Header: `Eventos (N)` + "Crear evento" link to `/events/create`. Style copied from `/admin/cursos/page.tsx` (inline styles via the existing pattern).
- Each row/card shows:
  - Date range (formatted server-side with `Intl.DateTimeFormat('es-ES', …)` for the admin view).
  - Title in Spanish.
  - Location.
  - Two badges: `Publicado`/`Borrador` and `Próximo`/`Pasado`.
  - Buttons: **Editar** (link to `/events/[id]/edit`), **Borrar** (form calling `deleteEvent`).

### `app/events/create/page.tsx` and `app/events/[id]/edit/page.tsx`

- Server Components.
- Call `requireAdmin()` and `redirect('/login')` / `redirect('/dashboard')` on failure (same pattern as `app/admin/layout.tsx`).
- `edit`: load event by `id`, `notFound()` if missing.
- Render `<EventForm initialData={…} />` (no prop on create).

### `components/EventForm.tsx` — Client Component

Shape modeled on `components/CourseForm.tsx`:

- State for `start_date`, `end_date`, `location`, `is_published`, and two `Record<Locale, string>` for `title` and `description`.
- 6-tab UI for the localized fields. Active tab defaults to `es`. Each tab shows a small dot indicator: green if both `title[locale]` and `description[locale]` are non-empty, gray otherwise — quick visual completeness check.
- Client-side validation: `title.es` and `description.es` required; `end_date >= start_date` (auto-fills `end_date = start_date` when empty).
- Submit serializes everything into `FormData` and calls `createEvent` or `updateEvent.bind(null, id)`.
- `isDirty` tracking copied from `CourseForm` to disable the save button on edit when nothing changed.

## i18n changes (`utils/dictionaries.ts`)

**Remove** in all 6 locales: `t.events.items` (lines ~101–106 in the `es` block and equivalents).

**Keep** in all 6 locales: `t.events.title`, `t.events.desc`, `t.events.details`.

**Add** in all 6 locales:

- `t.events.empty.title` (today: "Estamos preparando nuevas fechas" — hardcoded in JSX)
- `t.events.empty.text` (today: "Vuelve pronto…" — hardcoded)
- `t.events.upcoming.label` (today: "PRÓXIMA FECHA" / "PRÓXIMAS FECHAS")
- `t.events.past.label` (today: "ARCHIVO")
- `t.events.draft` ("Borrador" / "Draft" / …)
- `t.events.create` ("Nuevo evento" / "New event" / …)
- `t.events.edit` ("Editar")
- `t.events.delete` ("Borrar")
- `t.events.deleteConfirm` ("¿Borrar este evento?")

Strings hardcoded in Spanish today on the events page ("AGENDA", "Próximas paradas", "Fechas pasadas", "Próxima", "Pasado") become dictionary keys as part of the move, since we're already touching that section.

## Migration of existing events

New file `supabase/seed_events.sql`. Four `INSERT` statements reproducing today's hardcoded events, taking the localized title/description text from the current `t.events.items` of each locale before they are deleted from the dictionary. `is_published = true` for all four.

| event | start_date | end_date | location |
|---|---|---|---|
| Madrid Bachata Congress | 2026-02-15 | 2026-02-17 | Madrid, España |
| Masterclass Técnica de Giros | 2026-03-05 | 2026-03-05 | Online |
| Paris Sensual Weekend | 2026-04-20 | 2026-04-22 | París, Francia |
| Taller Intensivo Coreográfico | 2026-05-10 | 2026-05-10 | Sevilla, España |

The seed runs once after the migration. After it, the dictionary entries are deleted in the same PR.

## Tests

- `__tests__/actions/events.test.ts`
  - `createEvent` happy path → inserts row, calls `revalidatePath`.
  - `createEvent` rejects when not admin (`requireAdmin` throws / returns).
  - `createEvent` rejects `end_date < start_date`.
  - `createEvent` rejects empty `title.es` / `description.es` / `location`.
  - `updateEvent` updates only the given id.
  - `deleteEvent` deletes and revalidates.
- `__tests__/components/event-form.test.tsx`
  - Renders empty for create, prefilled for edit.
  - Tab dot indicator turns green when both fields filled for that locale.
  - Submit blocked when es fields empty.
  - Submit blocked when `end_date < start_date`.

No new E2E tests; existing E2E suite does not cover admin flows.

## Files affected

**New:**

- `supabase/events.sql` (migration: table + RLS + index + trigger)
- `supabase/seed_events.sql` (one-shot seed of the 4 current events)
- `app/events/actions.ts` (server actions)
- `app/events/create/page.tsx`
- `app/events/[id]/edit/page.tsx`
- `app/admin/eventos/page.tsx`
- `components/EventsClient.tsx` (extracted from current page)
- `components/EventForm.tsx`
- `components/EventForm.module.css`
- `__tests__/actions/events.test.ts`
- `__tests__/components/event-form.test.tsx`

**Modified:**

- `app/events/page.tsx` (becomes Server Component, fetches and passes data to `EventsClient`)
- `app/events/page.module.css` (small additions for admin floating buttons + draft badge)
- `components/admin/AdminSidebar.tsx` (new nav item)
- `utils/dictionaries.ts` (remove `events.items`, add new strings, in all 6 locales)
- `CLAUDE.md` (add `events` row to the database tables table)
