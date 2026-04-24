# Notifications Expansion — Design Spec

**Date:** 2026-04-24
**Status:** Draft (pending review)
**Owner:** ivangs23

## Problem

The current notifications system supports a single hardcoded use case: assignment grading. Users have no signal when meaningful interactions happen on their content — likes on their lesson comments, replies to their comments, comments on their community posts, or likes on their posts. This makes the social/community side of the platform feel inert.

## Goal

Extend the notification system to deliver in-app notifications for the following events, with deduplication and clickable navigation:

| Event | Recipient | Notification type |
|---|---|---|
| Someone likes a `comment` (lesson or community) | comment author | `comment_like` |
| Someone replies to a `comment` (lesson or community) | parent comment author | `comment_reply` |
| Someone comments on a `post` | post author | `post_comment` |
| Someone likes a `post` | post author | `post_like` |
| Admin grades a submission (existing) | submitter | `assignment_graded` |

Self-notifications (acting on your own content) are suppressed.

## Out of scope

- Email or push notifications.
- Supabase Realtime (current polling cadence is preserved).
- Time-window aggregation (e.g. "X liked your comment recently"). Dedupe is per-entity-lifetime, not per time window.
- User preferences ("don't notify me on likes").
- 404/stale-link handling beyond a generic toast (follow-up).

## Current state (verified)

- One `comments` table is shared by lessons and community: `lesson_id` and `post_id` are both nullable; `parent_id` already exists from `supabase/fix_all_comments_columns.sql`.
- `comment_likes` already supports likes on any comment row regardless of context (lesson or community).
- `notifications` table has `id, user_id, title, message, is_read, created_at` only.
- Posts have **no** likes table.
- The lesson comments UI ([app/actions/comments.ts](../../../app/actions/comments.ts), `CommentList`/`CommentItem`) already supports nested replies and likes — only the server actions need to fire notifications.
- The community comments UI ([app/community/[id]/page.tsx](../../../app/community/[id]/page.tsx)) renders comments as a flat list; nesting and likes are not exposed.
- `NotificationBell` ([components/NotificationBell.tsx](../../../components/NotificationBell.tsx)) polls the `notifications` table on mount, displays only `title`, has no mark-as-read interaction.

## Design

### 1. Database schema

Migration file: `supabase/notifications_v2.sql`.

```sql
-- 1. Notifications: enrich
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'generic'
    CHECK (type IN ('comment_like','comment_reply','post_comment','post_like','assignment_graded','generic')),
  ADD COLUMN IF NOT EXISTS entity_type text,        -- 'comment' | 'post'
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS actor_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key
  ON notifications (user_id, type, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, is_read, created_at DESC);

-- 2. Post likes (the only new table; comment_likes already covers both contexts)
CREATE TABLE IF NOT EXISTS post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by all authenticated"
  ON post_likes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike own"
  ON post_likes FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
```

Migration file: `supabase/upsert_notification_fn.sql`.

```sql
CREATE OR REPLACE FUNCTION upsert_notification(
  recipient_id uuid, actor_id uuid, n_type text,
  ent_type text, ent_id uuid, n_link text
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE VIEW notifications_with_actor AS
  SELECT n.*,
    p.full_name AS actor_name,
    p.avatar_url AS actor_avatar,
    array_length(n.actor_ids, 1) AS actor_count
  FROM notifications n
  LEFT JOIN profiles p ON p.id = n.actor_ids[1];
```

The `UNIQUE` index is partial (`WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL`) so legacy `assignment_graded` rows without `entity_type` continue to behave as independent inserts.

### 2. Server-side helper

File: `utils/notifications/server.ts`.

```ts
type NotifyInput = {
  recipientId: string
  actorId: string
  type: 'comment_like' | 'comment_reply' | 'post_comment' | 'post_like' | 'assignment_graded'
  entityType: 'comment' | 'post' | 'submission'
  entityId: string
  link: string
}

export async function notify(input: NotifyInput) {
  if (input.recipientId === input.actorId) return
  const supabase = createSupabaseAdmin()
  await supabase.rpc('upsert_notification', {
    recipient_id: input.recipientId,
    actor_id: input.actorId,
    n_type: input.type,
    ent_type: input.entityType,
    ent_id: input.entityId,
    n_link: input.link,
  })
}
```

Uses the admin client (service role) so notification writes bypass RLS — actors should not need write privileges on the recipient's notifications.

### 3. Server action wiring

| Action | File | Behavior |
|---|---|---|
| `toggleLike(commentId)` | [app/actions/comments.ts](../../../app/actions/comments.ts) | After a successful INSERT into `comment_likes` (not on DELETE), look up the comment to get `user_id`, `lesson_id` or `post_id`. Build the link, then `notify({ type: 'comment_like', entityType: 'comment', entityId: commentId, ... })`. |
| `addComment({ lessonId, parentId?, ... })` | [app/actions/comments.ts](../../../app/actions/comments.ts) | If `parentId` is set, fetch the parent comment's `user_id`, build link `/courses/{course_id}/lessons/{lesson_id}#comment-{newCommentId}`, and `notify({ type: 'comment_reply', ... })`. |
| `submitComment(postId, content, parentId?)` | [app/community/actions.ts](../../../app/community/actions.ts) | Always notify the post author with `type: 'post_comment'`. If `parentId` set, also notify the parent comment author with `type: 'comment_reply'`. (New optional `parentId` parameter — additive, default `null`.) |
| `togglePostLike(postId)` (new) | [app/community/actions.ts](../../../app/community/actions.ts) | INSERT/DELETE on `post_likes`. On INSERT, notify the post author with `type: 'post_like'`. |
| `gradeSubmission(...)` (existing) | [app/courses/actions.ts](../../../app/courses/actions.ts) | Replace direct `notifications` insert with a call to `notify({ type: 'assignment_graded', entityType: 'submission', entityId: submissionId, link: '/courses/...', ... })`. Backward-compat `title`/`message` fields are written separately by this action only (not by the helper) so the existing UI fallback path keeps working. |

Link construction:
- Lesson comment: requires fetching `course_id` from `lessons` joined with `comments` — done in the same action via a single Supabase query.
- Community: `/community/{post_id}` for likes, `/community/{post_id}#comment-{commentId}` for comments/replies.

### 4. Client UI

**`NotificationBell` ([components/NotificationBell.tsx](../../../components/NotificationBell.tsx)):**

- Query the `notifications_with_actor` view ordered by `updated_at DESC`, limit 20.
- Render text per `type`:
  - `comment_like` → `{actor_name}{ y N más si actor_count>1} dio like a tu comentario`
  - `comment_reply` → `{actor_name} respondió a tu comentario`
  - `post_comment` → `{actor_name} comentó tu publicación`
  - `post_like` → `{actor_name}{ y N más} dio like a tu publicación`
  - `assignment_graded` and `generic` → fall back to existing `message`.
- Click on item: call `markAsRead(id)` server action then `router.push(link)`.
- Footer "Marcar todas como leídas" → `markAllRead()` server action.
- Unread badge shows `count(is_read=false)`.

**Community UI:**

| Component | Path | Responsibility |
|---|---|---|
| `PostLikeButton` (new) | `components/PostLikeButton.tsx` | Client component, shows current like state + count, calls `togglePostLike`. |
| `CommunityCommentTree` (new) | `components/CommunityCommentTree.tsx` | Renders a single level of nested replies, includes per-comment like button (reuses existing `toggleLike` server action) and reply form. |
| Post list | [app/community/page.tsx](../../../app/community/page.tsx) | Add likes count + comments count per post (cheap aggregate query). |
| Post detail | [app/community/[id]/page.tsx](../../../app/community/[id]/page.tsx) | Replace flat comment list with `CommunityCommentTree`; mount `PostLikeButton` next to title. |

**Lesson comments UI:** no changes — existing `CommentList`/`CommentItem` already support both replies and likes; the notification side effect is server-side only.

**New server actions** in `app/actions/notifications.ts`:

```ts
export async function markAsRead(id: string)        // user-scoped UPDATE
export async function markAllRead()                  // bulk user-scoped UPDATE
```

### 5. Tests

Vitest, with the existing Supabase mock from `vitest.setup.ts`.

| File | Coverage |
|---|---|
| `__tests__/notifications/notify.test.ts` | `notify()` short-circuits when actor==recipient; calls `upsert_notification` RPC with correct params on the admin client. |
| `__tests__/actions/comments-notifications.test.ts` | `toggleLike` notifies on INSERT, not on DELETE; `addComment` with `parentId` notifies parent author. |
| `__tests__/actions/community-notifications.test.ts` | `submitComment` notifies post author; `togglePostLike` notifies on INSERT only. |
| `__tests__/actions/mark-read.test.ts` | `markAsRead`/`markAllRead` only affect the authenticated user's rows. |

### 6. Migration & rollout plan

1. Apply `supabase/notifications_v2.sql` (schema + post_likes table + RLS).
2. Apply `supabase/upsert_notification_fn.sql` (RPC + view).
3. Sanity-check: existing `notifications` rows have `type='generic'`, `entity_type=NULL`, render via `message` fallback. UI behavior unchanged for legacy rows.
4. Deploy code changes (helper, action wiring, UI updates) in a single PR.
5. Manual smoke test: like a comment as user B on user A's content; confirm A sees the notification with correct text and link; click navigates correctly; second like from user C updates the same row to "B y C más".

Rollback: drop the new columns/index/table/function; UI falls back gracefully because the renderer for unknown `type` uses `message`.

## Risks & mitigations

- **Concurrent likes** racing on the upsert: PL/pgSQL function runs the `INSERT ... ON CONFLICT DO UPDATE` atomically — no race window.
- **Self-notify on toggle**: `notify()` short-circuits in JS and is only invoked on INSERT, not DELETE — no spurious rows.
- **Unbounded `actor_ids` arrays** for viral content: acceptable initially. If a single notification array exceeds ~1000 entries we cap or move to a side table — tracked as follow-up, not blocker.
- **Stale links** when entities are deleted: cascade deletes mean the link path may 404. UI handles via standard 404 page; explicit toast deferred.
- **Backward compatibility with `assignment_graded`**: legacy rows lack the new columns' content but the partial unique index excludes them, so they keep behaving as today. The action update is included so new grading rows participate in the new flow.

## Open questions

None — all design decisions were resolved in brainstorming.
