-- supabase/2026_05_audit_indexes.sql
-- Indexes derived from audit recommendations.
-- Each is IF NOT EXISTS so the migration is idempotent.
--
-- Skipped (already exist in other migrations):
--   idx_notifications_user_read_created  -> notifications_user_unread_idx  (notifications_v2.sql:19-20)
--   idx_post_likes_post                  -> post_likes_post_id_idx         (notifications_v2.sql:45)

-- subscriptions: gating queries filter by user_id + status='active'/'trialing'
create index if not exists idx_subscriptions_user_status
  on subscriptions (user_id, status);

-- lesson_progress: per-user completion lookup, sorted by recency for activity stats
create index if not exists idx_lesson_progress_user_completed_updated
  on lesson_progress (user_id, is_completed, updated_at desc);

-- posts: feed is sorted by created_at desc
create index if not exists idx_posts_created_at_desc
  on posts (created_at desc);

-- comments: per-post timeline
create index if not exists idx_comments_post_created
  on comments (post_id, created_at);

-- course_purchases: access check by (user, course)
create index if not exists idx_course_purchases_user_course
  on course_purchases (user_id, course_id);
