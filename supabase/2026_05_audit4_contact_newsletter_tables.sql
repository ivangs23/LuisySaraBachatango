create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  inquiry_type text default 'general',
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_submissions_created
  on contact_submissions (created_at desc);

alter table public.contact_submissions enable row level security;

drop policy if exists "contact_submissions admin SELECT" on public.contact_submissions;
create policy "contact_submissions admin SELECT" on public.contact_submissions
  for select using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "contact_submissions service INSERT only" on public.contact_submissions;
create policy "contact_submissions service INSERT only" on public.contact_submissions
  for insert with check (false);


create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz null
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "newsletter admin SELECT" on public.newsletter_subscribers;
create policy "newsletter admin SELECT" on public.newsletter_subscribers
  for select using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );

drop policy if exists "newsletter service INSERT only" on public.newsletter_subscribers;
create policy "newsletter service INSERT only" on public.newsletter_subscribers
  for insert with check (false);

drop policy if exists "newsletter service UPDATE only" on public.newsletter_subscribers;
create policy "newsletter service UPDATE only" on public.newsletter_subscribers
  for update using (false);
