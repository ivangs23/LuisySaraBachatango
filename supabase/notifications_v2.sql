-- Notifications: enrich with type/entity/link/actor_ids/updated_at
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'generic'
    CHECK (type IN ('comment_like','comment_reply','post_comment','post_like','assignment_graded','generic')),
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS actor_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Allow nulls for legacy title/message (new typed notifications render from `type` + actor_ids).
ALTER TABLE notifications ALTER COLUMN title DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN message DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key
  ON notifications (user_id, type, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, is_read, created_at DESC);

-- New table: likes on community posts (comments_likes already covers both contexts)
CREATE TABLE IF NOT EXISTS post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Likes viewable by all authenticated" ON post_likes;
CREATE POLICY "Likes viewable by all authenticated"
  ON post_likes FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can like posts" ON post_likes;
CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike own" ON post_likes;
CREATE POLICY "Users can unlike own"
  ON post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS post_likes_post_id_idx ON post_likes (post_id);

NOTIFY pgrst, 'reload schema';
