-- Add postal_code to the landing registration.
-- On profiles it is PRIVATE by default: 2026_07_profiles_pii_revoke.sql revoked
-- the table-level SELECT from anon/authenticated and re-granted only specific
-- non-PII columns, so a newly added column receives no anon/authenticated grant
-- and is readable only by the service role (webhook provisioner / admin ops).
alter table public.pending_registrations add column if not exists postal_code text;
alter table public.profiles add column if not exists postal_code text;
