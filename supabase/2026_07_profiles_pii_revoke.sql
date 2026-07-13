-- profiles has RLS `select using (true)` (schema.sql), so anon/authenticated can
-- read every row. The landing registration PII columns must NOT be world-readable.
-- Column-level REVOKE keeps them readable only by the service role (the webhook
-- provisioner and admin operations that use the service-role client, which bypasses
-- these grants). full_name/avatar_url stay public for community features.
revoke select (country, city, date_of_birth, phone, marketing_consent, dance_level)
  on public.profiles from anon, authenticated;
