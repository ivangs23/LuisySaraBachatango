alter table public.lessons add column if not exists updated_at timestamptz not null default now();

-- Backfill existing rows (no-op on not-null default, but explicit for clarity).
update public.lessons set updated_at = now() where updated_at is null;
