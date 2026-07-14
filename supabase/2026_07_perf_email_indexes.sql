-- Performance: index the email lookups on the landing registration hot paths.
-- 1. pending_registrations(email): landingCheckout runs `delete ... where email`
--    (dedupe) on EVERY form submit — without this it's a seq scan on the table.
-- 2. profiles(email): the webhook provisioner (provisionFromPending +
--    provisionGuestPurchase) runs `select id where email` on EVERY payment to
--    resolve-or-create the account — without this it's a seq scan on profiles,
--    which grows with every user.
create index if not exists pending_registrations_email_idx
  on public.pending_registrations (email);

create index if not exists profiles_email_idx
  on public.profiles (email);
