-- Soft-delete archive for notifications: read+>90d notifications get a
-- deleted_at stamp so reads stay fast and the table doesn't grow without bound.
-- pg_cron is used if available; otherwise the human runs the function manually.

alter table notifications
  add column if not exists deleted_at timestamptz null;

-- Index that backs the "active notifications" reads.
create index if not exists idx_notifications_active
  on notifications (user_id, created_at desc)
  where deleted_at is null;

create or replace function archive_old_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update notifications
     set deleted_at = now()
   where is_read = true
     and created_at < now() - interval '90 days'
     and deleted_at is null;
end;
$$;

-- Refresh the view so it only returns active (non-archived) notifications.
-- Columns are listed explicitly (instead of n.*) so CREATE OR REPLACE VIEW
-- doesn't reorder existing columns when the new deleted_at is added to the
-- base table.
-- security_invoker = true is preserved so RLS on notifications still applies.
CREATE OR REPLACE VIEW notifications_with_actor
  WITH (security_invoker = true) AS
  SELECT n.id, n.user_id, n.title, n.message, n.is_read, n.created_at,
         n.type, n.entity_type, n.entity_id, n.link, n.actor_ids, n.updated_at,
         p.full_name AS actor_name,
         p.avatar_url AS actor_avatar,
         COALESCE(array_length(n.actor_ids, 1), 0) AS actor_count
  FROM notifications n
  LEFT JOIN profiles p ON p.id = n.actor_ids[1]
  WHERE n.deleted_at IS NULL;

GRANT SELECT ON notifications_with_actor TO authenticated;

-- archive_old_notifications is intended to be called only by pg_cron / service
-- role. Revoke EXECUTE from anon and authenticated so it's not callable via
-- /rest/v1/rpc.
REVOKE EXECUTE ON FUNCTION public.archive_old_notifications() FROM PUBLIC, anon, authenticated;

-- Schedule daily archive at 03:00 UTC if pg_cron is available.
-- Wrapped in DO block so the migration succeeds even when the extension
-- isn't installed (free Supabase tiers don't ship with it enabled by default).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'archive-notifications-daily',
      '0 3 * * *',
      $cron$select archive_old_notifications();$cron$
    );
  end if;
end $$;
