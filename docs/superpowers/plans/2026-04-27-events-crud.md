# Events CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded events list in `utils/dictionaries.ts` with an admin-managed CRUD backed by a new Supabase `events` table, exposed both at `/admin/eventos` and via inline admin buttons on the public `/events` page.

**Architecture:** New `events` table with localized JSONB `title`/`description` (6 locales) and `start_date`/`end_date` columns. Three Server Actions (`createEvent`, `updateEvent`, `deleteEvent`) protected by `requireAdmin()`. Public `/events` page becomes a Server Component that fetches from Supabase and delegates rendering to a `EventsClient` Client Component (preserves animations and `useLanguage()`). Admin list at `/admin/eventos`; create/edit forms at `/events/create` and `/events/[id]/edit` rendering a shared `EventForm`.

**Tech Stack:** Next.js 16 (App Router, RSC + Server Actions), Supabase (Postgres + RLS), CSS Modules, Vitest, `lucide-react` icons. Project conventions in `CLAUDE.md` and existing patterns in `app/courses/actions.ts`, `components/CourseForm.tsx`, `app/admin/cursos/page.tsx`.

**Spec:** [`docs/superpowers/specs/2026-04-27-events-crud-design.md`](../specs/2026-04-27-events-crud-design.md)

---

## File map

**New files:**
- `supabase/events.sql` — migration: table, indexes, RLS, updated_at trigger
- `supabase/seed_events.sql` — one-shot seed of the 4 current events
- `app/events/actions.ts` — `createEvent`, `updateEvent`, `deleteEvent` server actions + pure validators
- `app/events/create/page.tsx` — admin create page
- `app/events/[id]/edit/page.tsx` — admin edit page
- `app/admin/eventos/page.tsx` — admin event list
- `components/EventsClient.tsx` — client component owning the public events UI
- `components/EventForm.tsx` — shared create/edit form
- `components/EventForm.module.css` — form styles
- `__tests__/actions/events.test.ts` — pure-validator tests + action tests with Supabase mocks
- `__tests__/components/event-form.test.tsx` — form rendering + validation tests

**Modified files:**
- `app/events/page.tsx` — becomes a Server Component, fetches events, passes to `EventsClient`
- `app/events/page.module.css` — small additions: admin floating buttons, draft badge, "create" header button
- `components/admin/AdminSidebar.tsx` — add `Eventos` nav item
- `utils/dictionaries.ts` — remove `events.items` from all 6 locales; add new event-related keys to all 6 locales
- `CLAUDE.md` — add `events` row to the database tables table

---

## Task 1: Database migration (`supabase/events.sql`)

**Files:**
- Create: `supabase/events.sql`

This is a pure SQL file. The user will apply it via Supabase SQL editor. There is no automated test for the migration itself — the action tests use mocked Supabase clients.

- [ ] **Step 1: Write the migration**

Create `supabase/events.sql`:

```sql
-- Events table for the public agenda at /events.
-- Localized text lives in JSONB columns (es, en, fr, de, it, ja).

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  start_date    date not null,
  end_date      date not null,
  location      text not null,
  title         jsonb not null,
  description   jsonb not null,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint events_dates_chk check (end_date >= start_date),
  constraint events_location_chk check (length(trim(location)) > 0),
  constraint events_title_es_chk check (length(trim(coalesce(title->>'es', ''))) > 0),
  constraint events_description_es_chk check (length(trim(coalesce(description->>'es', ''))) > 0)
);

create index if not exists events_start_date_idx on public.events (start_date);
create index if not exists events_published_start_idx on public.events (is_published, start_date);

-- updated_at trigger
create or replace function public.set_events_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_events_updated_at();

-- RLS
alter table public.events enable row level security;

drop policy if exists events_public_read on public.events;
create policy events_public_read
  on public.events for select
  using (is_published = true);

drop policy if exists events_admin_read_all on public.events;
create policy events_admin_read_all
  on public.events for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists events_admin_write on public.events;
create policy events_admin_write
  on public.events for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/events.sql
git commit -m "feat(events): add events table migration with RLS"
```

The user will apply this manually via the Supabase SQL editor (same convention as other `supabase/*.sql` files in this project — see `CLAUDE.md`). Pause to confirm before proceeding to Task 2 if you need the schema active for manual smoke tests; the test tasks below do not depend on a live DB.

---

## Task 2: Pure validators in `app/events/actions.ts`

We extract validation into pure functions (matching the pattern used in `__tests__/actions/courses.test.ts`) so we can unit-test them without mocking Supabase end-to-end.

**Files:**
- Create: `app/events/actions.ts`
- Test: `__tests__/actions/events.test.ts`

- [ ] **Step 1: Write the failing tests for `parseEventForm`**

Create `__tests__/actions/events.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRevalidatePath = vi.fn()
const mockRedirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
const mockRequireAdmin = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/utils/admin/guard', () => ({
  requireAdmin: mockRequireAdmin,
  AdminGuardError: class AdminGuardError extends Error {
    constructor(public reason: string) { super(reason) }
  },
}))

// Supabase mock — built per-test
const mockFrom = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'admin-user-id' })
})

// ── parseEventForm ────────────────────────────────────────────────────────────

import { parseEventForm } from '@/app/events/actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('start_date', '2026-06-01')
  fd.set('end_date', '2026-06-03')
  fd.set('location', 'Madrid, España')
  fd.set('is_published', 'on')
  fd.set('title_es', 'Festival Test')
  fd.set('title_en', '')
  fd.set('title_fr', '')
  fd.set('title_de', '')
  fd.set('title_it', '')
  fd.set('title_ja', '')
  fd.set('description_es', 'Descripción del festival')
  fd.set('description_en', '')
  fd.set('description_fr', '')
  fd.set('description_de', '')
  fd.set('description_it', '')
  fd.set('description_ja', '')
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

describe('parseEventForm', () => {
  it('returns parsed payload when all required fields are present', () => {
    const result = parseEventForm(buildFormData())
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.payload.start_date).toBe('2026-06-01')
    expect(result.payload.end_date).toBe('2026-06-03')
    expect(result.payload.location).toBe('Madrid, España')
    expect(result.payload.is_published).toBe(true)
    expect(result.payload.title).toEqual({
      es: 'Festival Test', en: '', fr: '', de: '', it: '', ja: '',
    })
    expect(result.payload.description.es).toBe('Descripción del festival')
  })

  it('rejects when start_date is missing', () => {
    const result = parseEventForm(buildFormData({ start_date: '' }))
    expect('error' in result && result.error).toMatch(/fecha/i)
  })

  it('rejects when end_date is before start_date', () => {
    const fd = buildFormData({ start_date: '2026-06-05', end_date: '2026-06-01' })
    const result = parseEventForm(fd)
    expect('error' in result && result.error).toMatch(/posterior|igual|after/i)
  })

  it('accepts when start_date equals end_date', () => {
    const fd = buildFormData({ start_date: '2026-06-05', end_date: '2026-06-05' })
    const result = parseEventForm(fd)
    expect('error' in result).toBe(false)
  })

  it('rejects when location is empty after trim', () => {
    const result = parseEventForm(buildFormData({ location: '   ' }))
    expect('error' in result && result.error).toMatch(/ubicación|location/i)
  })

  it('rejects when title_es is empty after trim', () => {
    const result = parseEventForm(buildFormData({ title_es: '   ' }))
    expect('error' in result && result.error).toMatch(/título|title/i)
  })

  it('rejects when description_es is empty after trim', () => {
    const result = parseEventForm(buildFormData({ description_es: '' }))
    expect('error' in result && result.error).toMatch(/descripción|description/i)
  })

  it('treats missing is_published as false (draft)', () => {
    const fd = buildFormData()
    fd.delete('is_published')
    const result = parseEventForm(fd)
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.payload.is_published).toBe(false)
  })

  it('rejects malformed dates', () => {
    const result = parseEventForm(buildFormData({ start_date: 'not-a-date' }))
    expect('error' in result && result.error).toMatch(/fecha|date/i)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run __tests__/actions/events.test.ts`
Expected: FAIL — `Cannot find module '@/app/events/actions'`.

- [ ] **Step 3: Implement `parseEventForm` in `app/events/actions.ts`**

Create `app/events/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin, AdminGuardError } from '@/utils/admin/guard'

export type EventLocale = 'es' | 'en' | 'fr' | 'de' | 'it' | 'ja'
const LOCALES: EventLocale[] = ['es', 'en', 'fr', 'de', 'it', 'ja']

export type EventPayload = {
  start_date: string
  end_date: string
  location: string
  is_published: boolean
  title: Record<EventLocale, string>
  description: Record<EventLocale, string>
}

export type ParseResult =
  | { payload: EventPayload }
  | { error: string }

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime())
}

export function parseEventForm(formData: FormData): ParseResult {
  const start_date = String(formData.get('start_date') ?? '').trim()
  const end_date = String(formData.get('end_date') ?? '').trim()
  const location = String(formData.get('location') ?? '').trim()
  const is_published = formData.get('is_published') === 'on'

  if (!isValidIsoDate(start_date)) return { error: 'Fecha de inicio inválida' }
  if (!isValidIsoDate(end_date)) return { error: 'Fecha de fin inválida' }
  if (end_date < start_date) return { error: 'La fecha de fin debe ser igual o posterior a la de inicio' }
  if (location.length === 0) return { error: 'La ubicación es obligatoria' }

  const title = {} as Record<EventLocale, string>
  const description = {} as Record<EventLocale, string>
  for (const loc of LOCALES) {
    title[loc] = String(formData.get(`title_${loc}`) ?? '').trim()
    description[loc] = String(formData.get(`description_${loc}`) ?? '').trim()
  }

  if (title.es.length === 0) return { error: 'El título en español es obligatorio' }
  if (description.es.length === 0) return { error: 'La descripción en español es obligatoria' }

  return {
    payload: { start_date, end_date, location, is_published, title, description },
  }
}

// createEvent / updateEvent / deleteEvent are added in Tasks 3–5.
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run __tests__/actions/events.test.ts`
Expected: PASS — 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/events/actions.ts __tests__/actions/events.test.ts
git commit -m "feat(events): add parseEventForm validator with tests"
```

---

## Task 3: `createEvent` server action

**Files:**
- Modify: `app/events/actions.ts` (append `createEvent`)
- Modify: `__tests__/actions/events.test.ts` (append `createEvent` describe block)

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/actions/events.test.ts`:

```ts
// ── createEvent ───────────────────────────────────────────────────────────────

import { createEvent } from '@/app/events/actions'

describe('createEvent', () => {
  it('inserts the row, revalidates paths, and redirects to /admin/eventos on success', async () => {
    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insertFn = vi.fn().mockReturnValue({ select: insertSelect })
    mockFrom.mockReturnValue({ insert: insertFn })

    const fd = buildFormData()

    const url = await createEvent(fd).catch((err: Error) => err.message)

    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({
      start_date: '2026-06-01',
      end_date: '2026-06-03',
      location: 'Madrid, España',
      is_published: true,
    }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/eventos')
    expect(url).toBe('REDIRECT:/admin/eventos')
  })

  it('returns { error } when not admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const fd = buildFormData()
    const result = await createEvent(fd)
    expect(result).toEqual({ error: 'No autorizado' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns { error } when validation fails (no insert)', async () => {
    const fd = buildFormData({ title_es: '' })
    const result = await createEvent(fd)
    expect(result && 'error' in result).toBe(true)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns { error } when Supabase insert errors', async () => {
    const insertSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'db boom' } })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insertFn = vi.fn().mockReturnValue({ select: insertSelect })
    mockFrom.mockReturnValue({ insert: insertFn })

    const result = await createEvent(buildFormData())
    expect(result).toEqual({ error: 'db boom' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run __tests__/actions/events.test.ts`
Expected: FAIL — `createEvent` is not exported.

- [ ] **Step 3: Implement `createEvent`**

Append to `app/events/actions.ts`:

```ts
async function ensureAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin()
    return { ok: true }
  } catch (e) {
    if (e instanceof AdminGuardError) return { ok: false, error: 'No autorizado' }
    throw e
  }
}

export async function createEvent(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseEventForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('events')
    .insert(parsed.payload)
    .select('id')
    .single()

  if (error) {
    console.error('[createEvent] insert failed', error)
    return { error: error.message }
  }

  revalidatePath('/events')
  revalidatePath('/admin/eventos')
  redirect('/admin/eventos')
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npx vitest run __tests__/actions/events.test.ts`
Expected: PASS — 13 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/events/actions.ts __tests__/actions/events.test.ts
git commit -m "feat(events): add createEvent server action"
```

---

## Task 4: `updateEvent` server action

**Files:**
- Modify: `app/events/actions.ts`
- Modify: `__tests__/actions/events.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/actions/events.test.ts`:

```ts
// ── updateEvent ───────────────────────────────────────────────────────────────

import { updateEvent } from '@/app/events/actions'

describe('updateEvent', () => {
  it('updates the row by id, revalidates, and redirects to /admin/eventos', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
    mockFrom.mockReturnValue({ update: updateFn })

    const fd = buildFormData()
    const url = await updateEvent('event-123', fd).catch((err: Error) => err.message)

    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({
      start_date: '2026-06-01',
      location: 'Madrid, España',
    }))
    expect(eqFn).toHaveBeenCalledWith('id', 'event-123')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/eventos')
    expect(url).toBe('REDIRECT:/admin/eventos')
  })

  it('returns { error: "No autorizado" } when not admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const result = await updateEvent('id-1', buildFormData())
    expect(result).toEqual({ error: 'No autorizado' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns validation { error } and skips DB write', async () => {
    const result = await updateEvent('id-1', buildFormData({ description_es: '' }))
    expect(result && 'error' in result).toBe(true)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns DB error message when update fails', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'update failed' } })
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
    mockFrom.mockReturnValue({ update: updateFn })

    const result = await updateEvent('id-1', buildFormData())
    expect(result).toEqual({ error: 'update failed' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npx vitest run __tests__/actions/events.test.ts`
Expected: FAIL — `updateEvent` not exported.

- [ ] **Step 3: Implement `updateEvent`**

Append to `app/events/actions.ts`:

```ts
export async function updateEvent(id: string, formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseEventForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('events')
    .update(parsed.payload)
    .eq('id', id)

  if (error) {
    console.error('[updateEvent] update failed', { id, error })
    return { error: error.message }
  }

  revalidatePath('/events')
  revalidatePath('/admin/eventos')
  redirect('/admin/eventos')
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npx vitest run __tests__/actions/events.test.ts`
Expected: PASS — 17 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/events/actions.ts __tests__/actions/events.test.ts
git commit -m "feat(events): add updateEvent server action"
```

---

## Task 5: `deleteEvent` server action

**Files:**
- Modify: `app/events/actions.ts`
- Modify: `__tests__/actions/events.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/actions/events.test.ts`:

```ts
// ── deleteEvent ───────────────────────────────────────────────────────────────

import { deleteEvent } from '@/app/events/actions'

describe('deleteEvent', () => {
  it('deletes the row by id and revalidates the public + admin paths', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn().mockReturnValue({ eq: eqFn })
    mockFrom.mockReturnValue({ delete: deleteFn })

    const result = await deleteEvent('event-xyz')

    expect(deleteFn).toHaveBeenCalled()
    expect(eqFn).toHaveBeenCalledWith('id', 'event-xyz')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/eventos')
    expect(result).toBeUndefined()
  })

  it('returns { error } when not admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const result = await deleteEvent('event-xyz')
    expect(result).toEqual({ error: 'No autorizado' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns DB error message when delete fails', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'delete failed' } })
    const deleteFn = vi.fn().mockReturnValue({ eq: eqFn })
    mockFrom.mockReturnValue({ delete: deleteFn })

    const result = await deleteEvent('event-xyz')
    expect(result).toEqual({ error: 'delete failed' })
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `npx vitest run __tests__/actions/events.test.ts`
Expected: FAIL — `deleteEvent` not exported.

- [ ] **Step 3: Implement `deleteEvent`**

Append to `app/events/actions.ts`:

```ts
export async function deleteEvent(id: string): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase.from('events').delete().eq('id', id)

  if (error) {
    console.error('[deleteEvent] delete failed', { id, error })
    return { error: error.message }
  }

  revalidatePath('/events')
  revalidatePath('/admin/eventos')
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npx vitest run __tests__/actions/events.test.ts`
Expected: PASS — 20 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/events/actions.ts __tests__/actions/events.test.ts
git commit -m "feat(events): add deleteEvent server action"
```

---

## Task 6: `EventForm` component

A client component used by both `/events/create` and `/events/[id]/edit`. Mirrors the structure of `components/CourseForm.tsx`.

**Files:**
- Create: `components/EventForm.tsx`
- Create: `components/EventForm.module.css`
- Test: `__tests__/components/event-form.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/event-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/app/events/actions', () => ({
  createEvent: vi.fn().mockResolvedValue(undefined),
  updateEvent: vi.fn().mockResolvedValue(undefined),
}))

import EventForm from '@/components/EventForm'
import { createEvent, updateEvent } from '@/app/events/actions'

beforeEach(() => vi.clearAllMocks())

const baseInitial = {
  id: 'evt-1',
  start_date: '2026-07-01',
  end_date: '2026-07-03',
  location: 'Madrid, España',
  is_published: true,
  title: { es: 'T es', en: '', fr: '', de: '', it: '', ja: '' },
  description: { es: 'D es', en: '', fr: '', de: '', it: '', ja: '' },
}

describe('EventForm', () => {
  it('renders empty fields when no initialData (create mode)', () => {
    render(<EventForm />)
    expect((screen.getByLabelText('Ubicación') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Título Español') as HTMLInputElement).value).toBe('')
  })

  it('renders prefilled fields when initialData is provided (edit mode)', () => {
    render(<EventForm initialData={baseInitial} />)
    expect((screen.getByLabelText('Ubicación') as HTMLInputElement).value).toBe('Madrid, España')
    expect((screen.getByLabelText('Título Español') as HTMLInputElement).value).toBe('T es')
  })

  it('shows the per-locale completeness dot — complete when both title+description are filled, empty otherwise', () => {
    render(<EventForm initialData={baseInitial} />)
    const esTab = screen.getByRole('tab', { name: /Español/ })
    const enTab = screen.getByRole('tab', { name: /English/ })
    expect(esTab.querySelector('[data-state="complete"]')).not.toBeNull()
    expect(enTab.querySelector('[data-state="empty"]')).not.toBeNull()
  })

  it('blocks submission and shows an error when title_es is empty', async () => {
    render(<EventForm />)
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'Sevilla' } })
    fireEvent.change(screen.getByLabelText('Descripción Español'), { target: { value: 'desc' } })
    // title_es left empty
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar' }).closest('form')!)
    expect(await screen.findByText('El título en español es obligatorio')).toBeInTheDocument()
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('blocks submission when end_date < start_date', async () => {
    render(<EventForm initialData={baseInitial} />)
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-06-01' } })
    fireEvent.submit(screen.getByLabelText('Fecha de fin').closest('form')!)
    expect(
      await screen.findByText('La fecha de fin debe ser igual o posterior a la de inicio'),
    ).toBeInTheDocument()
    expect(updateEvent).not.toHaveBeenCalled()
  })

  it('calls createEvent with FormData when create-mode submit succeeds', async () => {
    render(<EventForm />)
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-08-02' } })
    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'Sevilla' } })
    fireEvent.change(screen.getByLabelText('Título Español'), { target: { value: 'Nuevo' } })
    fireEvent.change(screen.getByLabelText('Descripción Español'), { target: { value: 'Desc' } })
    fireEvent.submit(screen.getByLabelText('Ubicación').closest('form')!)

    await vi.waitFor(() => expect(createEvent).toHaveBeenCalledTimes(1))
    const fd = (createEvent as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as FormData
    expect(fd.get('title_es')).toBe('Nuevo')
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run __tests__/components/event-form.test.tsx`
Expected: FAIL — `Cannot find module '@/components/EventForm'`.

- [ ] **Step 3: Implement `EventForm.tsx`**

Create `components/EventForm.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { createEvent, updateEvent } from '@/app/events/actions'
import styles from './EventForm.module.css'

const LOCALES = ['es', 'en', 'fr', 'de', 'it', 'ja'] as const
type Locale = typeof LOCALES[number]

const LOCALE_LABEL: Record<Locale, string> = {
  es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano', ja: '日本語',
}

type EventInitialData = {
  id: string
  start_date: string
  end_date: string
  location: string
  is_published: boolean
  title: Record<Locale, string>
  description: Record<Locale, string>
}

type Props = { initialData?: EventInitialData }

const emptyLocalized = (): Record<Locale, string> =>
  ({ es: '', en: '', fr: '', de: '', it: '', ja: '' })

export default function EventForm({ initialData }: Props) {
  const [startDate, setStartDate] = useState(initialData?.start_date ?? '')
  const [endDate, setEndDate] = useState(initialData?.end_date ?? '')
  const [location, setLocation] = useState(initialData?.location ?? '')
  const [isPublished, setIsPublished] = useState(initialData?.is_published ?? true)
  const [title, setTitle] = useState<Record<Locale, string>>(initialData?.title ?? emptyLocalized())
  const [description, setDescription] = useState<Record<Locale, string>>(initialData?.description ?? emptyLocalized())
  const [activeLocale, setActiveLocale] = useState<Locale>('es')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-fill end_date if user only sets start_date
  useEffect(() => {
    if (startDate && !endDate) setEndDate(startDate)
  }, [startDate, endDate])

  const isDirty = useMemo(() => {
    if (!initialData) return true
    return (
      startDate !== initialData.start_date ||
      endDate !== initialData.end_date ||
      location !== initialData.location ||
      isPublished !== initialData.is_published ||
      LOCALES.some(loc => title[loc] !== initialData.title[loc]) ||
      LOCALES.some(loc => description[loc] !== initialData.description[loc])
    )
  }, [initialData, startDate, endDate, location, isPublished, title, description])

  const completeness = (loc: Locale): 'complete' | 'empty' =>
    title[loc].trim().length > 0 && description[loc].trim().length > 0 ? 'complete' : 'empty'

  function validate(): string | null {
    if (!startDate) return 'La fecha de inicio es obligatoria'
    if (!endDate) return 'La fecha de fin es obligatoria'
    if (endDate < startDate) return 'La fecha de fin debe ser igual o posterior a la de inicio'
    if (location.trim().length === 0) return 'La ubicación es obligatoria'
    if (title.es.trim().length === 0) return 'El título en español es obligatorio'
    if (description.es.trim().length === 0) return 'La descripción en español es obligatoria'
    return null
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError(null)
    const err = validate()
    if (err) { setValidationError(err); return }
    setValidationError(null)

    if (initialData && !isDirty) return

    const fd = new FormData()
    fd.set('start_date', startDate)
    fd.set('end_date', endDate)
    fd.set('location', location)
    if (isPublished) fd.set('is_published', 'on')
    for (const loc of LOCALES) {
      fd.set(`title_${loc}`, title[loc])
      fd.set(`description_${loc}`, description[loc])
    }

    setIsSubmitting(true)
    try {
      const result = initialData
        ? await updateEvent(initialData.id, fd)
        : await createEvent(fd)
      if (result && 'error' in result) setServerError(result.error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Fecha de inicio</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            required
            aria-label="Fecha de inicio"
          />
        </label>
        <label className={styles.field}>
          <span>Fecha de fin</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            required
            aria-label="Fecha de fin"
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>Ubicación</span>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Madrid, España"
          required
          aria-label="Ubicación"
        />
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={isPublished}
          onChange={e => setIsPublished(e.target.checked)}
        />
        <span>Publicado (visible en /events)</span>
      </label>

      <div className={styles.tabs} role="tablist" aria-label="Idiomas">
        {LOCALES.map(loc => (
          <button
            key={loc}
            type="button"
            role="tab"
            aria-selected={activeLocale === loc}
            aria-label={LOCALE_LABEL[loc]}
            onClick={() => setActiveLocale(loc)}
            className={`${styles.tab} ${activeLocale === loc ? styles.tabActive : ''}`}
          >
            <span
              className={styles.dot}
              data-state={completeness(loc)}
              aria-hidden
            />
            {LOCALE_LABEL[loc]}
          </button>
        ))}
      </div>

      {LOCALES.map(loc => (
        <div
          key={loc}
          role="tabpanel"
          hidden={activeLocale !== loc}
          className={styles.localePanel}
        >
          <label className={styles.field}>
            <span>Título ({LOCALE_LABEL[loc]})</span>
            <input
              type="text"
              value={title[loc]}
              onChange={e => setTitle({ ...title, [loc]: e.target.value })}
              aria-label={`Título ${LOCALE_LABEL[loc]}`}
            />
          </label>
          <label className={styles.field}>
            <span>Descripción ({LOCALE_LABEL[loc]})</span>
            <textarea
              rows={4}
              value={description[loc]}
              onChange={e => setDescription({ ...description, [loc]: e.target.value })}
              aria-label={`Descripción ${LOCALE_LABEL[loc]}`}
            />
          </label>
        </div>
      ))}

      {validationError && <p className={styles.error}>{validationError}</p>}
      {serverError && <p className={styles.error}>{serverError}</p>}

      <div className={styles.actions}>
        <button
          type="submit"
          disabled={isSubmitting || (initialData && !isDirty)}
          className={styles.submit}
        >
          {isSubmitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Create the styles**

Create `components/EventForm.module.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.9rem;
}

.field input,
.field textarea {
  padding: 0.55rem 0.75rem;
  border: 1px solid rgba(var(--primary-rgb), 0.25);
  border-radius: 6px;
  background: var(--background);
  color: var(--text-main);
  font: inherit;
}

.checkboxRow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  border-bottom: 1px solid rgba(var(--primary-rgb), 0.15);
  padding-bottom: 0.4rem;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-main);
  font-size: 0.85rem;
}

.tabActive {
  background: rgba(var(--primary-rgb), 0.1);
  border-color: rgba(var(--primary-rgb), 0.5);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot[data-state="complete"] { background: #22c55e; }
.dot[data-state="empty"]    { background: rgba(var(--primary-rgb), 0.3); }

.localePanel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.error {
  color: #b91c1c;
  font-size: 0.85rem;
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.submit {
  padding: 0.6rem 1.2rem;
  background: rgba(var(--primary-rgb), 1);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run __tests__/components/event-form.test.tsx`
Expected: PASS — 6 tests passing.

- [ ] **Step 6: Commit**

```bash
git add components/EventForm.tsx components/EventForm.module.css __tests__/components/event-form.test.tsx
git commit -m "feat(events): add EventForm component with i18n tabs"
```

---

## Task 7: Create page (`app/events/create/page.tsx`)

**Files:**
- Create: `app/events/create/page.tsx`

No new tests for the page itself — the form and the action both have tests.

- [ ] **Step 1: Implement the page**

Create `app/events/create/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { requireAdmin, AdminGuardError } from '@/utils/admin/guard'
import EventForm from '@/components/EventForm'

export const dynamic = 'force-dynamic'

export default async function CreateEventPage() {
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AdminGuardError) {
      if (e.reason === 'unauthenticated') redirect('/login')
      redirect('/dashboard')
    }
    throw e
  }

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Crear evento</h1>
      <EventForm />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `app/events/create/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/events/create/page.tsx
git commit -m "feat(events): add admin create page"
```

---

## Task 8: Edit page (`app/events/[id]/edit/page.tsx`)

**Files:**
- Create: `app/events/[id]/edit/page.tsx`

- [ ] **Step 1: Implement the page**

Create `app/events/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { requireAdmin, AdminGuardError } from '@/utils/admin/guard'
import { createClient } from '@/utils/supabase/server'
import EventForm from '@/components/EventForm'

export const dynamic = 'force-dynamic'

type Params = { id: string }

const EMPTY_LOCALIZED = { es: '', en: '', fr: '', de: '', it: '', ja: '' }

export default async function EditEventPage({ params }: { params: Promise<Params> }) {
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AdminGuardError) {
      if (e.reason === 'unauthenticated') redirect('/login')
      redirect('/dashboard')
    }
    throw e
  }

  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, start_date, end_date, location, is_published, title, description')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) notFound()

  const initialData = {
    id: data.id as string,
    start_date: data.start_date as string,
    end_date: data.end_date as string,
    location: data.location as string,
    is_published: data.is_published as boolean,
    title: { ...EMPTY_LOCALIZED, ...(data.title as Record<string, string>) },
    description: { ...EMPTY_LOCALIZED, ...(data.description as Record<string, string>) },
  }

  return (
    <div style={{ padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Editar evento</h1>
      <EventForm initialData={initialData} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add app/events/[id]/edit/page.tsx
git commit -m "feat(events): add admin edit page"
```

---

## Task 9: Convert `/events` to Server Component + extract `EventsClient`

This task is the largest UI change. We split the existing client page into a Server Component that fetches data and a Client Component that owns the rendering.

**Files:**
- Modify: `app/events/page.tsx`
- Create: `components/EventsClient.tsx`

- [ ] **Step 1: Create `components/EventsClient.tsx`**

Create `components/EventsClient.tsx` with the existing UI from `app/events/page.tsx`, modified to take props and use real `Date` objects.

```tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MapPin, ArrowUpRight, CalendarOff, Plus, Pencil, Trash2 } from 'lucide-react'
import Reveal from '@/components/Reveal'
import styles from '@/app/events/page.module.css'
import { useLanguage } from '@/context/LanguageContext'
import { deleteEvent } from '@/app/events/actions'
import type { Locale } from '@/utils/dictionaries'

export type EventRow = {
  id: string
  start_date: string
  end_date: string
  location: string
  is_published: boolean
  title: Record<string, string>
  description: Record<string, string>
}

type Props = {
  events: EventRow[]
  isAdmin: boolean
}

type Presentation = {
  startDay: number
  endDay: number
  monthLabel: string
  year: number
  endOfDayMs: number
}

function derive(start: string, end: string, locale: Locale): Presentation {
  const s = new Date(`${start}T00:00:00Z`)
  const e = new Date(`${end}T23:59:59Z`)
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
    .format(s)
    .replace('.', '')
    .toUpperCase()
  return {
    startDay: s.getUTCDate(),
    endDay: e.getUTCDate(),
    monthLabel,
    year: s.getUTCFullYear(),
    endOfDayMs: e.getTime(),
  }
}

function pickLocalized(map: Record<string, string>, locale: Locale): string {
  return (map[locale] && map[locale].length > 0) ? map[locale] : (map.es ?? '')
}

export default function EventsClient({ events, isAdmin }: Props) {
  const { t, locale } = useLanguage()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const enriched = useMemo(
    () => events.map(ev => ({ ...ev, presentation: derive(ev.start_date, ev.end_date, locale) })),
    [events, locale],
  )

  const now = Date.now()
  const upcoming = enriched.filter(ev => ev.presentation.endOfDayMs >= now)
  const past = enriched.filter(ev => ev.presentation.endOfDayMs < now)

  async function handleDelete(id: string) {
    if (!window.confirm(t.events.deleteConfirm)) return
    setPendingDelete(id)
    try {
      await deleteEvent(id)
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className={styles.container}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroCornerTL} aria-hidden="true" />
        <span className={styles.heroCornerTR} aria-hidden="true" />

        <div className={styles.heroInner}>
          <Reveal>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowLine} aria-hidden="true" />
              EN VIVO · TOUR 2026
              <span className={styles.eyebrowLine} aria-hidden="true" />
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className={styles.title}>
              {t.events.title.split(' ').slice(0, -1).join(' ')}{' '}
              <span className={styles.titleAccent}>
                {t.events.title.split(' ').slice(-1)[0] ?? ''}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className={styles.subtitle}>{t.events.desc}</p>
          </Reveal>

          <Reveal delay={0.18}>
            <span className={styles.heroMeta}>
              <span className={styles.heroMetaDot} aria-hidden="true" />
              {upcoming.length} {upcoming.length === 1 ? t.events.upcoming.singular : t.events.upcoming.plural}
            </span>
          </Reveal>

          {isAdmin && (
            <Reveal delay={0.22}>
              <Link href="/events/create" className={styles.createBtn}>
                <Plus size={14} aria-hidden /> {t.events.create}
              </Link>
            </Reveal>
          )}
        </div>
      </section>

      {/* UPCOMING */}
      <section className={styles.timeline}>
        <Reveal>
          <div className={styles.timelineHeader}>
            <div className={styles.timelineTitleBlock}>
              <span className={styles.timelineEyebrow}>
                <span className={styles.timelineEyebrowLine} aria-hidden="true" />
                {t.events.upcoming.eyebrow}
              </span>
              <h2 className={styles.timelineTitle}>
                {t.events.upcoming.heading}
                {upcoming.length > 0 && (
                  <span className={styles.timelineCount}>
                    ({String(upcoming.length).padStart(2, '0')})
                  </span>
                )}
              </h2>
            </div>
          </div>
        </Reveal>

        {upcoming.length > 0 ? (
          <div className={styles.grid}>
            {upcoming.map((event, i) => (
              <Reveal key={event.id} delay={Math.min(i * 0.05, 0.4)} direction="up" distance={20}>
                <article className={`${styles.eventCard} ${!event.is_published ? styles.eventCardDraft : ''}`}>
                  {isAdmin && (
                    <div className={styles.adminActions}>
                      <Link href={`/events/${event.id}/edit`} className={styles.adminBtn} aria-label={t.events.edit}>
                        <Pencil size={12} aria-hidden />
                      </Link>
                      <button
                        type="button"
                        className={styles.adminBtn}
                        onClick={() => handleDelete(event.id)}
                        disabled={pendingDelete === event.id}
                        aria-label={t.events.delete}
                      >
                        <Trash2 size={12} aria-hidden />
                      </button>
                    </div>
                  )}
                  {!event.is_published && isAdmin && (
                    <span className={styles.draftBadge}>{t.events.draft}</span>
                  )}

                  <div className={styles.dateBadge}>
                    <span className={styles.dateMonth}>{event.presentation.monthLabel}</span>
                    <span className={styles.dateDay}>
                      {String(event.presentation.startDay).padStart(2, '0')}
                    </span>
                    <span className={styles.dateYear}>{event.presentation.year}</span>
                    {event.presentation.endDay !== event.presentation.startDay && (
                      <span className={styles.dateRange}>
                        → {String(event.presentation.endDay).padStart(2, '0')}
                      </span>
                    )}
                  </div>

                  <div className={styles.cardContent}>
                    <span className={styles.eventLocation}>
                      <MapPin size={11} strokeWidth={2.4} aria-hidden="true" />
                      {event.location}
                    </span>
                    <h3 className={styles.eventTitle}>{pickLocalized(event.title, locale)}</h3>
                    <p className={styles.eventDescription}>{pickLocalized(event.description, locale)}</p>

                    <div className={styles.cardFooter}>
                      <span className={`${styles.statusPill} ${styles.statusUpcoming}`}>
                        {t.events.upcoming.pill}
                      </span>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <div className={styles.empty}>
              <div className={styles.emptyHalo} aria-hidden="true" />
              <span className={styles.emptyIcon} aria-hidden="true">
                <CalendarOff size={20} strokeWidth={1.8} />
              </span>
              <h3 className={styles.emptyTitle}>{t.events.empty.title}</h3>
              <p className={styles.emptyText}>{t.events.empty.text}</p>
            </div>
          </Reveal>
        )}
      </section>

      {/* PAST */}
      {past.length > 0 && (
        <section className={styles.timeline} style={{ marginTop: '2.5rem' }}>
          <Reveal>
            <div className={styles.timelineHeader}>
              <div className={styles.timelineTitleBlock}>
                <span className={styles.timelineEyebrow}>
                  <span className={styles.timelineEyebrowLine} aria-hidden="true" />
                  {t.events.past.eyebrow}
                </span>
                <h2 className={styles.timelineTitle}>
                  {t.events.past.heading}
                  <span className={styles.timelineCount}>
                    ({String(past.length).padStart(2, '0')})
                  </span>
                </h2>
              </div>
            </div>
          </Reveal>

          <div className={styles.grid}>
            {past.map((event, i) => (
              <Reveal key={event.id} delay={Math.min(i * 0.05, 0.3)} direction="up" distance={20}>
                <article className={`${styles.eventCard} ${styles.eventCardPast}`}>
                  {isAdmin && (
                    <div className={styles.adminActions}>
                      <Link href={`/events/${event.id}/edit`} className={styles.adminBtn} aria-label={t.events.edit}>
                        <Pencil size={12} aria-hidden />
                      </Link>
                      <button
                        type="button"
                        className={styles.adminBtn}
                        onClick={() => handleDelete(event.id)}
                        disabled={pendingDelete === event.id}
                        aria-label={t.events.delete}
                      >
                        <Trash2 size={12} aria-hidden />
                      </button>
                    </div>
                  )}
                  <div className={styles.dateBadge}>
                    <span className={styles.dateMonth}>{event.presentation.monthLabel}</span>
                    <span className={styles.dateDay}>
                      {String(event.presentation.startDay).padStart(2, '0')}
                    </span>
                    <span className={styles.dateYear}>{event.presentation.year}</span>
                  </div>

                  <div className={styles.cardContent}>
                    <span className={styles.eventLocation}>
                      <MapPin size={11} strokeWidth={2.4} aria-hidden="true" />
                      {event.location}
                    </span>
                    <h3 className={styles.eventTitle}>{pickLocalized(event.title, locale)}</h3>
                    <p className={styles.eventDescription}>{pickLocalized(event.description, locale)}</p>

                    <div className={styles.cardFooter}>
                      <span className={`${styles.statusPill} ${styles.statusPast}`}>
                        <CalendarDays size={10} strokeWidth={2.4} aria-hidden="true" />
                        {t.events.past.pill}
                      </span>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace `app/events/page.tsx` with the Server Component**

Replace the file's full contents with:

```tsx
import { createClient } from '@/utils/supabase/server'
import EventsClient, { type EventRow } from '@/components/EventsClient'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const supabase = await createClient()

  // Auth — non-throwing admin check (page is public)
  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = profile?.role === 'admin'
  }

  // RLS handles visibility (anon/non-admin only sees published).
  const { data: rows } = await supabase
    .from('events')
    .select('id, start_date, end_date, location, is_published, title, description')
    .order('start_date', { ascending: true })

  const events: EventRow[] = (rows ?? []) as EventRow[]
  return <EventsClient events={events} isAdmin={isAdmin} />
}
```

- [ ] **Step 3: Add the new CSS classes used by the admin overlay**

Append to `app/events/page.module.css`:

```css
/* ==== Admin extensions ==== */

.createBtn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1rem;
  padding: 0.55rem 1rem;
  background: rgba(var(--primary-rgb), 1);
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.85rem;
}

.adminActions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  gap: 0.3rem;
  z-index: 2;
}

.adminBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  border: none;
  cursor: pointer;
  text-decoration: none;
}

.adminBtn:hover { background: rgba(0, 0, 0, 0.75); }
.adminBtn:disabled { opacity: 0.5; cursor: not-allowed; }

.eventCard { position: relative; }

.eventCardDraft { opacity: 0.65; }

.draftBadge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 0.65rem;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  z-index: 2;
}
```

- [ ] **Step 4: Run the unit tests**

Run: `npm run test`
Expected: all tests pass.

Do NOT run `npm run lint` or `npx tsc --noEmit` yet. The new dictionary keys referenced by `EventsClient.tsx` (`t.events.upcoming.singular`, `t.events.empty.title`, etc.) only exist after Task 12, so type-checking will fail until then. Both lint and tsc are run at the end of Task 12 once the dictionary is updated.

- [ ] **Step 5: Commit**

```bash
git add app/events/page.tsx components/EventsClient.tsx app/events/page.module.css
git commit -m "refactor(events): convert /events to RSC + EventsClient with admin actions"
```

---

## Task 10: Admin list page (`app/admin/eventos/page.tsx`)

**Files:**
- Create: `app/admin/eventos/page.tsx`

- [ ] **Step 1: Implement the page**

Create `app/admin/eventos/page.tsx`:

```tsx
import Link from 'next/link'
import { CalendarDays, Plus, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { deleteEvent } from '@/app/events/actions'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  start_date: string
  end_date: string
  location: string
  is_published: boolean
  title: Record<string, string>
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`))
}

export default async function EventosAdminPage() {
  // The admin layout (app/admin/layout.tsx) already calls requireAdmin().
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('events')
    .select('id, start_date, end_date, location, is_published, title')
    .order('start_date', { ascending: false })

  const events = (rows ?? []) as Row[]
  const now = Date.now()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', fontWeight: 600 }}>
          Eventos <span style={{ fontWeight: 400, color: 'rgba(var(--text-rgb, 30, 30, 30), 0.55)', fontSize: '0.85em' }}>({events.length})</span>
        </h1>
        <Link href="/events/create" style={{
          padding: '0.55rem 1rem',
          background: 'rgba(var(--primary-rgb), 1)',
          color: 'white',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: '0.9rem',
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        }}>
          <Plus size={14} aria-hidden /> Crear evento
        </Link>
      </header>

      {events.length === 0 ? (
        <p style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>No hay eventos. Crea el primero.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {events.map(ev => {
            const isPast = new Date(`${ev.end_date}T23:59:59Z`).getTime() < now
            return (
              <article key={ev.id} style={{
                background: 'rgba(var(--primary-rgb), 0.03)',
                border: '1px solid rgba(var(--primary-rgb), 0.1)',
                borderRadius: 10,
                padding: '0.85rem 1rem',
                display: 'flex', flexDirection: 'column', gap: '0.45rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>
                  <CalendarDays size={12} aria-hidden />
                  {fmtDate(ev.start_date)}
                  {ev.end_date !== ev.start_date && <> — {fmtDate(ev.end_date)}</>}
                </div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                  {ev.title.es ?? '(sin título)'}
                </h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.7)' }}>
                  {ev.location}
                </p>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 4,
                    background: ev.is_published ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                    color: ev.is_published ? '#15803d' : 'inherit',
                  }}>{ev.is_published ? 'Publicado' : 'Borrador'}</span>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 4,
                    background: isPast ? 'rgba(0, 0, 0, 0.1)' : 'rgba(var(--primary-rgb), 0.15)',
                  }}>{isPast ? 'Pasado' : 'Próximo'}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                  <Link href={`/events/${ev.id}/edit`} style={{
                    flex: 1, padding: '0.45rem 0.6rem',
                    border: '1px solid rgba(var(--primary-rgb), 0.2)',
                    borderRadius: 6, color: 'var(--text-main)',
                    textDecoration: 'none', fontSize: '0.82rem',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                  }}>
                    <Pencil size={12} aria-hidden /> Editar
                  </Link>
                  <form action={deleteEvent.bind(null, ev.id)} style={{ flex: 1 }}>
                    <button type="submit" style={{
                      width: '100%', padding: '0.45rem 0.6rem',
                      background: 'rgba(220, 38, 38, 0.08)',
                      border: '1px solid rgba(220, 38, 38, 0.25)',
                      color: '#b91c1c',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                    }}>
                      <Trash2 size={12} aria-hidden /> Borrar
                    </button>
                  </form>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add app/admin/eventos/page.tsx
git commit -m "feat(admin): add /admin/eventos list page"
```

---

## Task 11: Add `Eventos` to the admin sidebar

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Edit the sidebar**

In `components/admin/AdminSidebar.tsx`, change the imports line:

```ts
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Inbox,
  GraduationCap,
  MessagesSquare,
  CalendarDays,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react'
```

Then change the `items` array to insert the new entry between `Cursos` and `Comunidad`:

```ts
const items: Item[] = [
  { href: '/admin', label: 'Inicio', Icon: LayoutDashboard },
  { href: '/admin/alumnos', label: 'Alumnos', Icon: Users },
  { href: '/admin/estadisticas', label: 'Estadísticas', Icon: BarChart3 },
  { href: '/admin/entregas', label: 'Entregas', Icon: Inbox, badge: pendingSubmissions },
  { href: '/admin/cursos', label: 'Cursos', Icon: GraduationCap },
  { href: '/admin/eventos', label: 'Eventos', Icon: CalendarDays },
  { href: '/admin/comunidad', label: 'Comunidad', Icon: MessagesSquare },
]
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/admin/AdminSidebar.tsx
git commit -m "feat(admin): add Eventos to sidebar"
```

---

## Task 12: Dictionary cleanup + new keys (all 6 locales)

This task touches 12 places in `utils/dictionaries.ts` (one delete + one add per locale). The new keys are required by `EventsClient.tsx` from Task 9.

**Files:**
- Modify: `utils/dictionaries.ts`

- [ ] **Step 1: Read the current `events` block of each locale to find exact line ranges**

Run: `grep -n "events:" utils/dictionaries.ts`
Use the output to locate each `events: {` block and the matching `items: { ... }` to remove.

- [ ] **Step 2: For each locale (`es`, `en`, `fr`, `de`, `it`, `ja`), replace the `events` block**

For each locale, replace the existing `events: { title, desc, details, items: { ... } }` with the new shape below. Use the locale-appropriate strings. Example for Spanish:

```ts
    events: {
      title: "Agenda & Eventos",
      desc: "Descubre dónde estaremos próximamente. Ven a aprender, bailar y disfrutar con nosotros en vivo.",
      details: "Más Información",
      create: "Nuevo evento",
      edit: "Editar",
      delete: "Borrar",
      deleteConfirm: "¿Borrar este evento?",
      draft: "Borrador",
      empty: {
        title: "Estamos preparando nuevas fechas",
        text: "Vuelve pronto o síguenos en redes para enterarte de la próxima parada."
      },
      upcoming: {
        eyebrow: "AGENDA",
        heading: "Próximas paradas",
        pill: "Próxima",
        singular: "PRÓXIMA FECHA",
        plural: "PRÓXIMAS FECHAS"
      },
      past: {
        eyebrow: "ARCHIVO",
        heading: "Fechas pasadas",
        pill: "Pasado"
      }
    },
```

For the other locales, translate each string. Reference values to use:

| Key | EN | FR | DE | IT | JA |
|---|---|---|---|---|---|
| `create` | New event | Nouvel événement | Neue Veranstaltung | Nuovo evento | 新しいイベント |
| `edit` | Edit | Modifier | Bearbeiten | Modifica | 編集 |
| `delete` | Delete | Supprimer | Löschen | Elimina | 削除 |
| `deleteConfirm` | Delete this event? | Supprimer cet événement ? | Diese Veranstaltung löschen? | Eliminare questo evento? | このイベントを削除しますか？ |
| `draft` | Draft | Brouillon | Entwurf | Bozza | 下書き |
| `empty.title` | We're preparing new dates | Nous préparons de nouvelles dates | Wir bereiten neue Termine vor | Stiamo preparando nuove date | 新しい日程を準備中です |
| `empty.text` | Come back soon or follow us on social media for the next stop. | Revenez bientôt ou suivez-nous sur les réseaux sociaux pour la prochaine étape. | Schauen Sie bald wieder vorbei oder folgen Sie uns in den sozialen Medien für den nächsten Termin. | Torna presto o seguici sui social per la prossima tappa. | 近日中にまたチェックしてください。次の開催情報はSNSでお知らせします。 |
| `upcoming.eyebrow` | AGENDA | AGENDA | AGENDA | AGENDA | アジェンダ |
| `upcoming.heading` | Next stops | Prochaines étapes | Nächste Stationen | Prossime tappe | 次の開催地 |
| `upcoming.pill` | Upcoming | À venir | Bevorstehend | Prossimo | まもなく |
| `upcoming.singular` | UPCOMING DATE | DATE À VENIR | KOMMENDER TERMIN | DATA IN ARRIVO | まもなく開催 |
| `upcoming.plural` | UPCOMING DATES | DATES À VENIR | KOMMENDE TERMINE | DATE IN ARRIVO | 今後の予定 |
| `past.eyebrow` | ARCHIVE | ARCHIVES | ARCHIV | ARCHIVIO | アーカイブ |
| `past.heading` | Past dates | Dates passées | Vergangene Termine | Date passate | 過去の日程 |
| `past.pill` | Past | Passé | Vergangen | Passato | 終了 |

For `title`, `desc`, `details` keep the existing locale strings already present.

- [ ] **Step 3: Verify the dictionary still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. (The `Translations` type is inferred from the first locale; once `es` matches the new shape, the other locales must too.)

If TS complains about a missing key in any locale, add it.

- [ ] **Step 4: Run all tests**

Run: `npm run test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add utils/dictionaries.ts
git commit -m "i18n(events): replace hardcoded items with admin-managed copy"
```

---

## Task 13: Seed file for the 4 existing events (`supabase/seed_events.sql`)

**Files:**
- Create: `supabase/seed_events.sql`

The localized strings come from the dictionary as it was *before* Task 12 (the historical text we want to preserve).

- [ ] **Step 1: Write the seed**

Create `supabase/seed_events.sql`:

```sql
-- Seeds the 4 events that previously lived in utils/dictionaries.ts (t.events.items).
-- Run once after applying supabase/events.sql.

insert into public.events (start_date, end_date, location, is_published, title, description) values
(
  '2026-02-15', '2026-02-17', 'Madrid, España', true,
  jsonb_build_object(
    'es', 'Madrid Bachata Congress',
    'en', 'Madrid Bachata Congress',
    'fr', 'Madrid Bachata Congress',
    'de', 'Madrid Bachata Congress',
    'it', 'Madrid Bachata Congress',
    'ja', 'マドリードバチャタコングレス'
  ),
  jsonb_build_object(
    'es', 'Tres días de puro baile. Estaremos impartiendo dos talleres de Bachatango Fusión y ofreciendo un show exclusivo el sábado noche.',
    'en', 'Three days of pure dance. We will be teaching two Bachatango Fusion workshops and performing an exclusive show on Saturday night.',
    'fr', 'Trois jours de pure danse. Nous donnerons deux ateliers de Bachatango Fusion et un show exclusif le samedi soir.',
    'de', 'Drei Tage purer Tanz. Wir leiten zwei Bachatango-Fusion-Workshops und eine exklusive Show am Samstagabend.',
    'it', 'Tre giorni di puro ballo. Terremo due workshop di Bachatango Fusion e uno show esclusivo il sabato sera.',
    'ja', '3日間のダンス三昧。バチャタンゴフュージョンのワークショップを2つ開催し、土曜夜には特別ショーを披露します。'
  )
),
(
  '2026-03-05', '2026-03-05', 'Online', true,
  jsonb_build_object(
    'es', 'Masterclass Técnica de Giros',
    'en', 'Turn Technique Masterclass',
    'fr', 'Masterclass Technique de Tours',
    'de', 'Masterclass Drehtechnik',
    'it', 'Masterclass Tecnica dei Giri',
    'ja', 'ターンテクニック・マスタークラス'
  ),
  jsonb_build_object(
    'es', 'Clase intensiva online de 2 horas enfocada en el equilibrio y la fluidez en los giros. Incluye sesión de preguntas y respuestas.',
    'en', 'A 2-hour online intensive class focused on balance and fluidity in turns. Includes a Q&A session.',
    'fr', 'Cours intensif en ligne de 2 heures sur l''équilibre et la fluidité des tours. Inclut une session de questions/réponses.',
    'de', 'Zweistündiger Online-Intensivkurs zu Gleichgewicht und Fluss bei Drehungen. Inklusive Q&A-Session.',
    'it', 'Lezione intensiva online di 2 ore su equilibrio e fluidità nei giri. Include una sessione di domande e risposte.',
    'ja', 'バランスと流れに重点を置いた2時間のオンライン集中クラス。Q&Aセッション含む。'
  )
),
(
  '2026-04-20', '2026-04-22', 'París, Francia', true,
  jsonb_build_object(
    'es', 'Paris Sensual Weekend',
    'en', 'Paris Sensual Weekend',
    'fr', 'Paris Sensual Weekend',
    'de', 'Paris Sensual Weekend',
    'it', 'Paris Sensual Weekend',
    'ja', 'パリ・センシュアル・ウィークエンド'
  ),
  jsonb_build_object(
    'es', 'Vuelve el evento más elegante del año. Únete a nosotros en la ciudad del amor para aprender a conectar a otro nivel.',
    'en', 'The most elegant event of the year is back. Join us in the city of love to learn to connect on another level.',
    'fr', 'L''événement le plus élégant de l''année revient. Rejoignez-nous dans la ville de l''amour pour apprendre à vous connecter à un autre niveau.',
    'de', 'Die eleganteste Veranstaltung des Jahres ist zurück. Treffen Sie uns in der Stadt der Liebe und lernen Sie, sich auf einer neuen Ebene zu verbinden.',
    'it', 'Torna l''evento più elegante dell''anno. Unisciti a noi nella città dell''amore per imparare a connetterti a un altro livello.',
    'ja', '今年最もエレガントなイベントが帰ってきます。愛の都パリで、もう一段深いつながりを学びましょう。'
  )
),
(
  '2026-05-10', '2026-05-10', 'Sevilla, España', true,
  jsonb_build_object(
    'es', 'Taller Intensivo Coreográfico',
    'en', 'Choreography Intensive Workshop',
    'fr', 'Atelier Intensif Chorégraphique',
    'de', 'Intensiver Choreografie-Workshop',
    'it', 'Workshop Intensivo di Coreografia',
    'ja', '振付集中ワークショップ'
  ),
  jsonb_build_object(
    'es', 'Aprende nuestra última coreografía en un taller de 4 horas. Nivel intermedio/avanzado.',
    'en', 'Learn our latest choreography in a 4-hour workshop. Intermediate/advanced level.',
    'fr', 'Apprenez notre dernière chorégraphie dans un atelier de 4 heures. Niveau intermédiaire/avancé.',
    'de', 'Lernen Sie unsere neueste Choreografie in einem 4-stündigen Workshop. Mittleres/fortgeschrittenes Niveau.',
    'it', 'Impara la nostra ultima coreografia in un workshop di 4 ore. Livello intermedio/avanzato.',
    'ja', '4時間のワークショップで最新の振付を学びましょう。中級〜上級者向け。'
  )
);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/seed_events.sql
git commit -m "feat(events): seed 4 existing events from former dictionary entries"
```

The user will run this once via the Supabase SQL editor after applying `events.sql`.

---

## Task 14: Document the new table in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Edit the database tables section**

In `CLAUDE.md`, find the `### Key Database Tables` section. Add a new row to the table after the `courses` row:

```markdown
| `events` | Public agenda; localized `title`/`description` JSONB (es/en/fr/de/it/ja), `start_date`/`end_date`, `is_published` |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document events table in CLAUDE.md"
```

---

## Task 15: Manual smoke test

This is a real browser run, not automated.

- [ ] **Step 1: Apply the migration in Supabase**

Open the Supabase SQL editor and paste the contents of `supabase/events.sql`. Run it. Verify the `events` table appears in Table Editor with the expected columns and RLS enabled.

- [ ] **Step 2: Apply the seed**

Paste and run `supabase/seed_events.sql`. Verify 4 rows appear.

- [ ] **Step 3: Start the dev server**

Run: `npm run dev`
Open http://localhost:3000/events.

- [ ] **Step 4: Verify the public view**

- 4 events render (Madrid, Online masterclass, París, Sevilla).
- Month abbreviations match the active locale (switch to English with the language switcher → "FEB", "MAR", "APR", "MAY"; to Japanese → uses `Intl.DateTimeFormat('ja')`).
- Upcoming/past split is consistent with today's date (2026-04-27 → Madrid, masterclass and Paris should be past; Sevilla should be upcoming).
- No admin buttons visible when logged out or as non-admin user.

- [ ] **Step 5: Log in as an admin**

Use an admin account (`profiles.role = 'admin'`). Reload `/events`.

- "+ Nuevo evento" button visible in the hero.
- Each card shows pencil + trash buttons in the top-right corner.
- Click "+ Nuevo evento" → form opens at `/events/create`.

- [ ] **Step 6: Create a draft event**

Fill in start_date `2026-09-01`, end_date `2026-09-02`, location `Test City`, title_es `Test event`, description_es `Test description`, **uncheck** "Publicado". Save.

- Redirect lands on `/admin/eventos`.
- The new event appears with `Borrador` badge.
- Open `/events` in a private/incognito window — the draft event must NOT appear.
- Open `/events` as admin — the draft appears with reduced opacity and `Borrador` badge.

- [ ] **Step 7: Edit the event**

From `/admin/eventos` click "Editar". Change the location to `Granada, España`. Save. Verify the change appears on both the admin list and `/events`.

- [ ] **Step 8: Delete the event**

From `/events` (as admin) click the trash icon on the test event. Confirm. The card disappears. Verify it's also gone from `/admin/eventos`.

- [ ] **Step 9: Sidebar entry**

Open `/admin`. Confirm the sidebar shows "Eventos" between "Cursos" and "Comunidad", with the calendar icon.

- [ ] **Step 10: Stop the dev server**

`Ctrl+C`. No commit — this task is verification only.

---

## Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 2: Lint + type-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: production build completes with no errors.
