-- Backstop for the race condition between concurrent /api/checkout calls.
-- The conditional UPDATE in the route should prevent this, but the partial
-- unique index makes orphan customers impossible at the DB layer.
--
-- WHERE clause: NULL values are still allowed multiple times (one per row).

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;
