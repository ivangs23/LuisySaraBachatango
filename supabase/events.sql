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
