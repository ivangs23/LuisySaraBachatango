-- Pending landing registrations: holds the buyer's data (incl. a bcrypt
-- password_hash, NEVER plaintext) between form submit and payment confirmation.
-- The webhook creates the account from this row on checkout.session.completed
-- and deletes it. Service role only (webhook + landing action). No public access.
create table if not exists public.pending_registrations (
  id uuid primary key default gen_random_uuid(),   -- pendingId (Stripe client_reference_id)
  email text not null,
  full_name text,
  password_hash text not null,
  country text,
  city text,
  date_of_birth date,
  phone text,
  marketing_consent boolean not null default false,
  dance_level text,
  course_id uuid,
  amount_expected integer,                          -- cents, traceability only (not a hard gate)
  created_at timestamptz not null default now()
);

create index if not exists pending_registrations_created_at_idx
  on public.pending_registrations (created_at);

alter table public.pending_registrations enable row level security;

-- Explicit deny for anon/authenticated on all ops (service_role has BYPASSRLS).
drop policy if exists "pending_registrations_no_select" on public.pending_registrations;
drop policy if exists "pending_registrations_no_insert" on public.pending_registrations;
drop policy if exists "pending_registrations_no_update" on public.pending_registrations;
drop policy if exists "pending_registrations_no_delete" on public.pending_registrations;
create policy "pending_registrations_no_select" on public.pending_registrations for select using (false);
create policy "pending_registrations_no_insert" on public.pending_registrations for insert with check (false);
create policy "pending_registrations_no_update" on public.pending_registrations for update using (false);
create policy "pending_registrations_no_delete" on public.pending_registrations for delete using (false);
