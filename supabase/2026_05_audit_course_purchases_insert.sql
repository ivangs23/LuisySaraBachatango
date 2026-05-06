-- supabase/2026_05_audit_course_purchases_insert.sql
-- Course purchases are inserted exclusively by the Stripe webhook running with
-- the service role (which bypasses RLS). User sessions must never insert directly,
-- so we add an explicit deny-all INSERT policy as defense in depth.

drop policy if exists "course_purchases_insert_service_only" on course_purchases;

create policy "course_purchases_insert_service_only" on course_purchases
  for insert
  with check (false);

-- IMPORTANT: do NOT add another INSERT policy on course_purchases without
-- removing this one. RLS evaluates multiple permissive policies with OR;
-- a permissive policy added later would shadow this deny-all and allow
-- direct inserts from user sessions, breaking the service-role-only
-- contract.
