CREATE OR REPLACE FUNCTION upsert_notification(
  recipient_id uuid,
  actor_id uuid,
  n_type text,
  ent_type text,
  ent_id uuid,
  n_link text
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, entity_type, entity_id, link, actor_ids, is_read, updated_at)
  VALUES (recipient_id, n_type, ent_type, ent_id, n_link, ARRAY[actor_id], false, now())
  ON CONFLICT (user_id, type, entity_type, entity_id)
    WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL
  DO UPDATE SET
    actor_ids = (
      CASE WHEN actor_id = ANY(notifications.actor_ids)
        THEN notifications.actor_ids
        ELSE array_append(notifications.actor_ids, actor_id)
      END
    ),
    is_read = false,
    updated_at = now(),
    link = EXCLUDED.link;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION upsert_notification(uuid, uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_notification(uuid, uuid, text, text, uuid, text) TO service_role;

CREATE OR REPLACE VIEW notifications_with_actor
  WITH (security_invoker = true) AS
  SELECT n.*,
    p.full_name AS actor_name,
    p.avatar_url AS actor_avatar,
    COALESCE(array_length(n.actor_ids, 1), 0) AS actor_count
  FROM notifications n
  LEFT JOIN profiles p ON p.id = n.actor_ids[1];

GRANT SELECT ON notifications_with_actor TO authenticated;

NOTIFY pgrst, 'reload schema';
