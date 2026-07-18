-- CRITICAL: the profiles UPDATE RLS policy is `using (auth.uid() = id)` with no
-- WITH CHECK and no column restriction, and Supabase's default table-level
-- UPDATE grant to `authenticated` covers ALL columns — so any logged-in user can
-- PATCH their own row setting role='admin' via the public anon key and become a
-- full admin. Fix with column-level grants (mirrors the SELECT lock-down model):
-- revoke the blanket UPDATE, then grant UPDATE only on the columns the profile
-- form (app/profile/actions.ts#updateProfile) legitimately writes: full_name,
-- avatar_url, updated_at, and social links (instagram, facebook, tiktok, youtube).
-- `role`, `email`, `stripe_customer_id`, `id`, country, city, postal_code,
-- date_of_birth, phone, dance_level, marketing_consent, and all consent/terms
-- columns are intentionally excluded — they are written only by the service role
-- (admin ops, webhook provisioner, landing form), which bypasses grants.
revoke update on public.profiles from anon, authenticated;
grant update (
  full_name, avatar_url, updated_at,
  instagram, facebook, tiktok, youtube
) on public.profiles to authenticated;
