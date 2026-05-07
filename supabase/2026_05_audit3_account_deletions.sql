-- supabase/2026_05_audit3_account_deletions.sql
-- Conserva un registro mínimo de eliminaciones para resolver disputas
-- de facturación. No es PII directa: solo SHA-256 del email + timestamp.

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  email_sha256 text not null,
  deleted_at timestamptz not null default now()
);

alter table public.account_deletions enable row level security;

-- Solo admin puede leer.
drop policy if exists "account_deletions admin SELECT" on public.account_deletions;
create policy "account_deletions admin SELECT" on public.account_deletions
  for select using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );

-- Solo service role inserta (vía deleteAccount con admin client).
drop policy if exists "account_deletions service INSERT" on public.account_deletions;
create policy "account_deletions service INSERT" on public.account_deletions
  for insert with check (false);

create index if not exists idx_account_deletions_deleted_at
  on account_deletions (deleted_at desc);
