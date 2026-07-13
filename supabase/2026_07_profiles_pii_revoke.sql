-- profiles has RLS `select using (true)` (schema.sql) AND the Supabase default
-- table-level SELECT grant to anon/authenticated, so every column is world-readable
-- via the public anon key. A column-level REVOKE does NOT override the table grant,
-- so we revoke the table grant and re-grant SELECT on ONLY the non-PII columns.
-- The 6 landing registration PII columns (country, city, date_of_birth, phone,
-- marketing_consent, dance_level) are then readable only by the service role
-- (the webhook provisioner + admin operations, which bypass grants). full_name/
-- avatar_url/social links stay public for community features.
revoke select on public.profiles from anon, authenticated;
grant select (id, email, full_name, avatar_url, updated_at, role, instagram, facebook, tiktok, youtube, stripe_customer_id)
  on public.profiles to anon, authenticated;
