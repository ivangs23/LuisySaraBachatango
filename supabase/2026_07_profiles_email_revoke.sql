-- Tighten the public read grant on profiles further: remove `email` and
-- `stripe_customer_id` from the anon/authenticated column allowlist.
--
-- profiles has RLS `select using (true)`, so any granted column is readable for
-- EVERY row via the public anon key. The prior lock-down (2026_07_profiles_pii_
-- revoke.sql) kept `email` + `stripe_customer_id` public, which lets anyone
-- holding the anon key (shipped in the browser bundle) harvest every user's
-- email address. No user-session code needs them: profile/page.tsx now reads the
-- owner's email from the auth session (user.email), not profiles.email, and
-- never displayed stripe_customer_id; all server-side reads use the service role
-- (which bypasses grants). Community/comments only read full_name + avatar_url.
--
-- Apply AFTER deploying the profile/page.tsx change that stops selecting these
-- columns via the user-session client.
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, updated_at, role, instagram, facebook, tiktok, youtube)
  on public.profiles to anon, authenticated;
