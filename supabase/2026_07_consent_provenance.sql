-- GDPR Art. 7 accountability: record WHEN and WHICH version of the terms the
-- buyer accepted, and when they opted into marketing — a boolean alone can't
-- demonstrate valid consent. Carried on pending_registrations from form submit
-- to provisioning, then copied to profiles. On profiles these are private by
-- default (the column-grant model from 2026_07_profiles_pii_revoke.sql only
-- grants an explicit non-PII allowlist; new columns get no anon/authenticated
-- grant).
alter table public.pending_registrations
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists marketing_consent_at timestamptz;

alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists marketing_consent_at timestamptz;
