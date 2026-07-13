-- Landing registration collects these; the provisioner UPDATEs them after
-- createUser (handle_new_user only sets id/email/full_name). NEVER stores the
-- password hash here (profiles is world-readable via RLS select using(true)).
alter table public.profiles
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists date_of_birth date,
  add column if not exists phone text,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists dance_level text;
